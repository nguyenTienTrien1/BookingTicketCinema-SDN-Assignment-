export function memberPointsQuote(balance, subtotal, value, step = 1) {
    const maxPoints = Math.max(0, Math.floor(Math.min(balance, Math.floor(subtotal / 1000)) / step) * step);
    const selectedPoints = Number(value);
    const pointsValid = String(value).trim() !== '' && Number.isSafeInteger(selectedPoints)
        && selectedPoints >= 0 && selectedPoints % step === 0 && selectedPoints <= maxPoints;
    return { maxPoints, selectedPoints, pointsValid, discount: pointsValid ? selectedPoints * 1000 : 0 };
}
