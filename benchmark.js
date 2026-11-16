const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const FILES = Number(process.argv[2]) || 300;
const RUNS = Number(process.argv[3]) || 5;
const DIR = path.join(__dirname, 'benchmark-data');
const CONTENT = 'Тестовое содержимое файла для бенчмарка. '.repeat(10);

const fileName = (i) => path.join(DIR, `file_${i}.txt`);
const range = () => Array.from({ length: FILES }, (_, i) => i);

function syncSequential() {
    for (let i = 0; i < FILES; i++) {
        fs.writeFileSync(fileName(i), CONTENT, 'utf8');
        fs.readFileSync(fileName(i), 'utf8');
        fs.unlinkSync(fileName(i));
    }
}

function callbackSequential() {
    return new Promise((resolve, reject) => {
        let i = 0;
        function next() {
            if (i >= FILES) return resolve();
            const file = fileName(i++);
            fs.writeFile(file, CONTENT, 'utf8', (err) => {
                if (err) return reject(err);
                fs.readFile(file, 'utf8', (err) => {
                    if (err) return reject(err);
                    fs.unlink(file, (err) => {
                        if (err) return reject(err);
                        next();
                    });
                });
            });
        }
        next();
    });
}

function callbackParallel() {
    return new Promise((resolve, reject) => {
        let done = 0;
        range().forEach((i) => {
            const file = fileName(i);
            fs.writeFile(file, CONTENT, 'utf8', (err) => {
                if (err) return reject(err);
                fs.readFile(file, 'utf8', (err) => {
                    if (err) return reject(err);
                    fs.unlink(file, (err) => {
                        if (err) return reject(err);
                        if (++done === FILES) resolve();
                    });
                });
            });
        });
    });
}

async function promiseSequential() {
    for (let i = 0; i < FILES; i++) {
        await fs.promises.writeFile(fileName(i), CONTENT, 'utf8');
        await fs.promises.readFile(fileName(i), 'utf8');
        await fs.promises.unlink(fileName(i));
    }
}

async function promiseParallel() {
    await Promise.all(range().map(async (i) => {
        await fs.promises.writeFile(fileName(i), CONTENT, 'utf8');
        await fs.promises.readFile(fileName(i), 'utf8');
        await fs.promises.unlink(fileName(i));
    }));
}

const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function measure(label, fn) {
    // прогрев, не учитывается в результатах
    await fn();

    const times = [];
    for (let r = 0; r < RUNS; r++) {
        const start = performance.now();
        await fn();
        times.push(performance.now() - start);
    }

    return {
        label,
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        median: median(times),
        min: Math.min(...times),
        max: Math.max(...times)
    };
}

async function main() {
    fs.mkdirSync(DIR, { recursive: true });

    console.log('=== ИССЛЕДОВАНИЕ ПРОИЗВОДИТЕЛЬНОСТИ ===');
    console.log(`Node.js ${process.version}`);
    console.log(`Файлов: ${FILES} (write -> read -> unlink), прогонов: ${RUNS} (+1 прогревочный)\n`);

    const tests = [
        ['Синхронно (последовательно)', syncSequential],
        ['Колбэки (последовательно)', callbackSequential],
        ['Промисы (последовательно)', promiseSequential],
        ['Колбэки (параллельно)', callbackParallel],
        ['Промисы (параллельно)', promiseParallel]
    ];

    const results = [];
    try {
        for (const [label, fn] of tests) {
            process.stdout.write(`Замер: ${label}... `);
            const res = await measure(label, fn);
            results.push(res);
            console.log(`${res.median.toFixed(1)} мс`);
        }
    } finally {
        fs.rmSync(DIR, { recursive: true, force: true });
    }

    const fastest = Math.min(...results.map(r => r.median));

    console.log('\nРезультаты (мс):');
    console.table(results.map(r => ({
        'Подход': r.label,
        'Среднее': +r.avg.toFixed(2),
        'Медиана': +r.median.toFixed(2),
        'Мин': +r.min.toFixed(2),
        'Макс': +r.max.toFixed(2),
        'Операций/сек': Math.round((FILES * 3) / (r.median / 1000)),
        'Медл. чем лучший': `x${(r.median / fastest).toFixed(2)}`
    })));

    const slowest = results.reduce((a, b) => (b.median > a.median ? b : a));
    const best = results.find(r => r.median === fastest);
    console.log(`Самый быстрый: ${best.label} (${best.median.toFixed(1)} мс)`);
    console.log(`Самый медленный: ${slowest.label} (${slowest.median.toFixed(1)} мс)`);
    console.log('Примечание: результаты зависят от диска, ОС и антивируса; сравнивайте запуски на одной машине.');
}

main().catch((err) => {
    console.error('❌ Ошибка бенчмарка:', err);
    fs.rmSync(DIR, { recursive: true, force: true });
    process.exit(1);
});
