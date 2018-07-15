export function mergeLists(aArr = [], bArr = [], comparer) {
    const difference = bArr.filter(b => !aArr.some(a => comparer(a, b)));
    aArr.push(...difference);
}
