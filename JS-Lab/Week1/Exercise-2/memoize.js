function memoize(fn){
    // The cache is captured in the closure — it's private to this specific
  // memoized function. Nothing outside can reach in and mutate it directly.

  const cache = new Map();

  return function memoize(...args) {
    // We need one cache key per unique combination of arguments.
    // JSON.stringify is a simple (not bulletproof — fails on functions,
    // undefined, circular refs) way to turn args into a single key.

    const key = JSON.stringify(args);

    if(cache.has(key)){
        return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

module.exports = { memoize };

/*
Why Map and not a plain object (worth being able to justify — 
this is exactly the kind of thing you flagged wanting called out):
a plain object's keys are always coerced to strings and it inherits 
from Object.prototype, so a malicious/accidental key like "__proto__" or "toString" 
can collide with inherited properties. Map has no prototype pollution risk, preserves 
insertion order, and its .size is O(1) instead of Object.keys(obj).length. 
For a cache specifically, Map is the senior-default choice.

The junior trap here: memoizing a function that takes objects/arrays as arguments by reference, 
expecting fn({a:1}) to hit cache twice — it won't, because JSON.stringify will actually produce 
the same string for two different object instances with the same shape, so oddly it works for 
plain data, but it silently breaks for anything with methods, Date objects, or undefined values 
in the args. Worth knowing the limitation, not just the happy path.
*/