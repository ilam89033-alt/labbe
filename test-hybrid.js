const FileManagerHybrid = require('./fileOperationsHybrid');
const {
    FileManagerError,
    ValidationError,
    FileNotFoundError,
    FileExistsError
} = FileManagerHybrid;

const fm = new FileManagerHybrid('./test-data-hybrid');

const waitCallback = (fn) => new Promise((resolve) => fn((err, result) => resolve({ err, result })));

async function main() {
    console.log('=== ТЕСТИРОВАНИЕ ГИБРИДНОГО МОДУЛЯ ===\n');

    console.log('1. Стиль КОЛБЭКОВ');
    let r = await waitCallback(cb => fm.createFile('hybrid1.txt', 'Привет из колбэка!', cb));
    console.log(r.err ? `   ❌ ${r.err.message}` : `   ✅ createFile -> ${r.result}`);

    r = await waitCallback(cb => fm.readFile('hybrid1.txt', cb));
    console.log(r.err ? `   ❌ ${r.err.message}` : `   ✅ readFile -> "${r.result}"`);

    console.log('\n2. Стиль ПРОМИСОВ (async/await)');
    const content = await fm.readFile('hybrid1.txt');
    console.log(`   ✅ readFile -> "${content}"`);

    const stats = await fm.getFileStats('hybrid1.txt');
    console.log(`   ✅ getFileStats -> ${stats.size} байт, isFile=${stats.isFile}`);

    fm.readFile('hybrid1.txt')
        .then(text => console.log(`   ✅ .then() тоже работает -> "${text}"`));
    await new Promise(res => setTimeout(res, 50));

    console.log('\n3. Параллельные операции');
    const paths = await fm.createMultipleFiles([
        { filename: 'a.txt', content: 'A' },
        { filename: 'b.txt', content: 'B' },
        { filename: 'c.txt', content: 'C' }
    ]);
    console.log(`   ✅ Создано файлов: ${paths.length}`);

    const list = await fm.listFiles();
    console.log(`   ✅ Список: ${list.join(', ')}`);

    const all = await fm.readMultipleFiles(list);
    console.log(`   ✅ Прочитано: ${JSON.stringify(all)}`);

    console.log('\n4. ОБРАБОТКА ОШИБОК');

    try {
        await fm.readFile('net-takogo.txt');
    } catch (err) {
        console.log(`   ✅ [промис] ${err.name}: ${err.message}`);
        console.log(`      instanceof FileNotFoundError: ${err instanceof FileNotFoundError}, code: ${err.code}`);
    }

    r = await waitCallback(cb => fm.deleteFile('net-takogo.txt', cb));
    console.log(`   ✅ [колбэк] ${r.err.name}: ${r.err.message}`);

    try {
        await fm.createFile('hybrid1.txt', 'повтор', { overwrite: false });
    } catch (err) {
        console.log(`   ✅ ${err.name}: ${err.message} (instanceof FileExistsError: ${err instanceof FileExistsError})`);
    }

    try {
        await fm.createFile('', 'пустое имя');
    } catch (err) {
        console.log(`   ✅ ${err.name}: ${err.message}`);
    }

    try {
        await fm.createFile('x.txt', 12345);
    } catch (err) {
        console.log(`   ✅ ${err.name}: ${err.message}`);
    }

    r = await waitCallback(cb => fm.readFile('../package.json', cb));
    console.log(`   ✅ [колбэк] ${r.err.name}: ${r.err.message}`);

    console.log(`   ✅ ValidationError наследует FileManagerError: ${new ValidationError('x') instanceof FileManagerError}`);

    console.log('\n5. Очистка...');
    const files = await fm.listFiles();
    await Promise.all(files.map(f => fm.deleteFile(f)));
    console.log(`   ✅ Удалено файлов: ${files.length}`);

    console.log('\n✅ Все проверки завершены!');
}

main().catch(err => {
    console.error('\n❌ Непредвиденная ошибка:', err);
    process.exit(1);
});
