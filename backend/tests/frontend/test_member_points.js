import assert from 'node:assert/strict';
import { test } from 'node:test';
import { memberPointsQuote } from "../../../frontend/src/utils/memberPoints.js";

test('20 points reduce a 229,000 VND order by 20,000 VND', () => {
    assert.deepEqual(memberPointsQuote(20, 229000, '20'), {
        maxPoints: 20, selectedPoints: 20, pointsValid: true, discount: 20000
    });
    assert.equal(memberPointsQuote(20, 229000, '10').discount, 10000);
    assert.equal(memberPointsQuote(20, 229000, '0').discount, 0);
});

test('empty, negative, fractional, unsafe and excessive points cannot reduce the total', () => {
    for (const value of ['', ' ', '-1', '1.5', '21', 'NaN', '9007199254740992']) {
        const quote = memberPointsQuote(20, 229000, value);
        assert.equal(quote.pointsValid, false, value);
        assert.equal(quote.discount, 0, value);
    }
});

test('redemption is limited by order value, including promotion discounts', () => {
    assert.equal(memberPointsQuote(300, 229000, '229').discount, 229000);
    assert.equal(memberPointsQuote(300, 229000, '230').pointsValid, false);
    assert.equal(memberPointsQuote(20, 19500, '20').pointsValid, false);
    assert.equal(memberPointsQuote(20, 19500, '19').discount, 19000);
    assert.equal(memberPointsQuote(20, 0, '0').pointsValid, true);
    assert.equal(memberPointsQuote(0, 229000, '1').pointsValid, false);
});

test('configured steps still work and insufficient points cannot be redeemed', () => {
    assert.equal(memberPointsQuote(20, 229000, '20', 100).pointsValid, false);
    assert.equal(memberPointsQuote(20, 229000, '0', 100).pointsValid, true);
    assert.equal(memberPointsQuote(300, 229000, '200', 100).discount, 200000);
    assert.equal(memberPointsQuote(300, 229000, '229', 100).pointsValid, false);
});
