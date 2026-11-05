import * as memberService from '../services/memberService.js';

export async function search(req, res, next) {
    try {
        const result = await memberService.searchMembers(req.query.q);
        console.info('[MEMBER LOOKUP]', JSON.stringify({ action: 'search', employeeId: req.user._id, results: result.members.length }));
        res.json(result);
    } catch (error) { next(error); }
}

export async function detail(req, res, next) {
    try {
        const member = await memberService.getMember(req.params.id);
        console.info('[MEMBER LOOKUP]', JSON.stringify({ action: 'detail', employeeId: req.user._id, memberId: member._id }));
        res.json({ member });
    } catch (error) { next(error); }
}
