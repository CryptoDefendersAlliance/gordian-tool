export function mergeLists(aArr = [], bArr = [], comparer) {
    const difference = bArr.filter(b => !aArr.some(a => comparer(a, b)));
    aArr.push(...difference);
}

export function getDistanceBetweenPoints(x1, y1, x2, y2) {
    const a = x1 - x2;
    const b = y1 - y2;

    return Math.sqrt(a * a + b * b);
}
