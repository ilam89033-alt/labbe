const fs = require('fs');
const path = require('path');

class FileManagerError extends Error {
    constructor(message, { operation, filename, code, cause } = {}) {
        super(message);
        this.name = this.constructor.name;
        this.operation = operation;
        this.filename = filename;
        this.code = code;
        if (cause) this.cause = cause;
    }
}

// неверные аргументы
class ValidationError extends FileManagerError {}

// ENOENT
class FileNotFoundError extends FileManagerError {}

// EEXIST
class FileExistsError extends FileManagerError {}

// EACCES, EPERM
class PermissionError extends FileManagerError {}

// прочие ошибки ФС
class FileSystemError extends FileManagerError {}

// Преобразует системную ошибку в свой класс ошибки
function wrapError(err, operation, filename) {
    if (err instanceof FileManagerError) return err;

    const details = { operation, filename, code: err.code, cause: err };
    const target = filename ? `"${filename}"` : 'директории';

    switch (err.code) {
        case 'ENOENT':
            return new FileNotFoundError(`Файл или путь не найден: ${target}`, details);
        case 'EEXIST':
            return new FileExistsError(`Файл уже существует: ${target}`, details);
        case 'EACCES':
        case 'EPERM':
            return new PermissionError(`Нет прав доступа: ${target}`, details);
        case 'EISDIR':
            return new FileSystemError(`${target} является директорией, а не файлом`, details);
        default:
            return new FileSystemError(`Ошибка файловой системы (${operation}): ${err.message}`, details);
    }
}

// Колбэк, если передан, иначе промис. nextTick защищает от двойного вызова колбэка
function hybrid(operation, callback) {
    const promise = operation();

    if (typeof callback === 'function') {
        promise.then(
            (result) => process.nextTick(callback, null, result),
            (err) => process.nextTick(callback, err)
        );
        return undefined;
    }

    return promise;
}

// Позволяет пропускать options: fn(a, cb) и fn(a, options, cb)
function normalizeArgs(options, callback) {
    if (typeof options === 'function') {
        return { options: {}, callback: options };
    }
    return { options: options || {}, callback };
}

class FileManagerHybrid {
    constructor(baseDir = './data-hybrid') {
        this.baseDir = path.resolve(baseDir);

        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
            console.log(`Создана директория: ${this.baseDir}`);
        }
    }

    _resolvePath(filename, operation) {
        if (typeof filename !== 'string' || filename.trim() === '') {
            throw new ValidationError('Имя файла должно быть непустой строкой', {
                operation,
                filename: String(filename),
                code: 'EINVAL'
            });
        }

        // Защита от выхода за пределы baseDir
        const filePath = path.resolve(this.baseDir, filename);
        const relative = path.relative(this.baseDir, filePath);

        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            throw new ValidationError('Путь выходит за пределы базовой директории', {
                operation,
                filename,
                code: 'EINVAL'
            });
        }

        return filePath;
    }

    createFile(filename, content, options, callback) {
        const args = normalizeArgs(options, callback);

        return hybrid(async () => {
            const filePath = this._resolvePath(filename, 'createFile');

            if (typeof content !== 'string' && !Buffer.isBuffer(content)) {
                throw new ValidationError('Содержимое должно быть строкой или Buffer', {
                    operation: 'createFile',
                    filename,
                    code: 'EINVAL'
                });
            }

            const overwrite = args.options.overwrite !== false;
            try {
                // 'wx' выбрасывает EEXIST, если файл уже есть
                await fs.promises.writeFile(filePath, content, {
                    encoding: 'utf8',
                    flag: overwrite ? 'w' : 'wx'
                });
                return filePath;
            } catch (err) {
                throw wrapError(err, 'createFile', filename);
            }
        }, args.callback);
    }

    readFile(filename, callback) {
        return hybrid(async () => {
            const filePath = this._resolvePath(filename, 'readFile');
            try {
                return await fs.promises.readFile(filePath, 'utf8');
            } catch (err) {
                throw wrapError(err, 'readFile', filename);
            }
        }, callback);
    }

    getFileStats(filename, callback) {
        return hybrid(async () => {
            const filePath = this._resolvePath(filename, 'getFileStats');
            try {
                const stats = await fs.promises.stat(filePath);
                return {
                    size: stats.size,
                    created: stats.birthtime,
                    modified: stats.mtime,
                    isFile: stats.isFile()
                };
            } catch (err) {
                throw wrapError(err, 'getFileStats', filename);
            }
        }, callback);
    }

    deleteFile(filename, callback) {
        return hybrid(async () => {
            const filePath = this._resolvePath(filename, 'deleteFile');
            try {
                await fs.promises.unlink(filePath);
            } catch (err) {
                throw wrapError(err, 'deleteFile', filename);
            }
        }, callback);
    }

    listFiles(callback) {
        return hybrid(async () => {
            try {
                const entries = await fs.promises.readdir(this.baseDir, { withFileTypes: true });
                return entries.filter(e => e.isFile()).map(e => e.name);
            } catch (err) {
                throw wrapError(err, 'listFiles');
            }
        }, callback);
    }

    createMultipleFiles(files, callback) {
        return hybrid(async () => {
            if (!Array.isArray(files)) {
                throw new ValidationError('files должен быть массивом', {
                    operation: 'createMultipleFiles',
                    code: 'EINVAL'
                });
            }
            return await Promise.all(
                files.map(({ filename, content }) => this.createFile(filename, content))
            );
        }, callback);
    }

    readMultipleFiles(filenames, callback) {
        return hybrid(async () => {
            if (!Array.isArray(filenames)) {
                throw new ValidationError('filenames должен быть массивом', {
                    operation: 'readMultipleFiles',
                    code: 'EINVAL'
                });
            }
            const results = await Promise.all(
                filenames.map(async (filename) => ({ [filename]: await this.readFile(filename) }))
            );
            return Object.assign({}, ...results);
        }, callback);
    }
}

module.exports = FileManagerHybrid;
module.exports.FileManagerHybrid = FileManagerHybrid;
module.exports.FileManagerError = FileManagerError;
module.exports.ValidationError = ValidationError;
module.exports.FileNotFoundError = FileNotFoundError;
module.exports.FileExistsError = FileExistsError;
module.exports.PermissionError = PermissionError;
module.exports.FileSystemError = FileSystemError;
