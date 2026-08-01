const { memoize } = require('./memoize');

function slowSqaure(n) {
    console.log('computing sqaure of ', n);
    for(let i=0; i<1e8; i++){}

    return n * n;
}

const fastSqaure = memoize(slowSqaure);

console.log(fastSqaure(5));
console.log(fastSqaure(5));
console.log(fastSqaure(6));