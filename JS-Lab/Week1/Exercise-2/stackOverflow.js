function recurseForever(depth  = 0){
    // Deliberately no meaningful base case — we WANT this to blow up,
  // to see the failure mode, not to write correct recursion.
  console.log(`depth: ${depth}`);
  return recurseForever(depth + 1);
}

try {
  recurseForever();
} catch (err) {
  console.log('Caught:', err.message);
  console.log('Error name:', err.name); // "RangeError"
}

/*
Why this exists: the call stack is a fixed-size structure
 (in V8, roughly 10,000–15,000 frames depending on frame complexity, not a fixed number — it's a memory budget, not a frame count). 
 Every function call pushes a frame; every return pops one. Recursion without a base case — or with a base case that's unreachable — 
 keeps pushing until the stack's memory budget is exhausted, and the engine throws RangeError: Maximum call stack size exceeded rather
  than actually corrupting memory.

1- The console will print a lot of depth: N lines before it dies — count roughly how many. 
On a typical machine this lands somewhere in the 10,000–15,000 range, but it's not deterministic — 
it depends on how much local state each frame holds (this function holds almost none, so you'll get a 
fairly high number; a recursive function with several local variables per call will overflow at a noticeably lower depth).


2- Node's default behavior wraps this in a real, catchable RangeError — unlike a true C-level stack smash,
 JS's engine checks stack depth cooperatively, so you get a normal exception you can try/catch around, exactly 
 like the code above shows. This is worth saying explicitly in an interview: "it's a soft, catchable error in JS,
  not memory corruption" — people sometimes conflate this with a segfault.


3- To observe it via Chrome DevTools instead of just the terminal: run node --inspect-brk stackOverflow.js, 
open chrome://inspect, click "inspect" on the target, and hit resume. When it throws, the debugger will pause 
and show you the full call stack panel on the right — you'll see the same frame (recurseForever) repeated thousands 
of times, which is a good visual of "the stack" as an actual literal stack of identical frames, not an abstract concept.
*/