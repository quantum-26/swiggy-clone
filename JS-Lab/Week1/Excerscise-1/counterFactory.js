function createCounter(startingValue = 0){
    // `count` lives in the outer function's scope.
  // Once createCounter() returns, that scope would normally be garbage
  // collected — EXCEPT the returned functions below still reference `count`,
  // so the JS engine keeps it alive. That kept-alive variable is the closure.
    let count = startingValue;

    return {
        increment() {
            count += 1;
            return count;
        },
        decrement() {
            count -= 1;
            return count;
        },
        reset() {
            count = startingValue;
            return count;
        },
        value() {
            return count;
        },
    };
}

module.exports = { createCounter };