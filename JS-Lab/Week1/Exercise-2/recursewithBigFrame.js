function recurseWithBigFrame(arr = []) {
  const localJunk = new Array(1000).fill(0); // bigger per-frame footprint
  return recurseWithBigFrame([...arr, localJunk.length]);
}

try {
  recurseWithBigFrame();
} catch (err) {
  console.log('Caught with bigger frames:', err.message);
}