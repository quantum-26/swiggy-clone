// counterFactory.test.js (or just run manually with node)

const { createCounter } = require('./counterFactory');

const counterA = createCounter();
const counterB = createCounter(100);

console.log(counterA.increment());
console.log(counterA.increment());
console.log(counterB.increment());

// The key thing to notice: counterA and counterB each have their OWN `count`.
// Calling createCounter() twice creates two separate closures — two separate
// private variables — even though they share the exact same function code.
console.log(counterA.value()); // 2
console.log(counterB.value()); // 101