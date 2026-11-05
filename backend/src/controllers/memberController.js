import * as memberService from '../services/memberService.js';

export async function search(req, res, next) {
    try {
        const result = await memberService.searchMembers(req.query.q, req.user.role);
        console.info('[MEMBER LOOKUP]', JSON.stringify({ action: 'search', actorId: req.user._id, actorRole: req.user.role, results: result.members.length }));
        res.json(result);
    } catch (error) { next(error); }
}

export async function detail(req, res, next) {
    try {
        const member = await memberService.getMember(req.params.id, req.user.role);
        console.info('[MEMBER LOOKUP]', JSON.stringify({ action: 'detail', actorId: req.user._id, actorRole: req.user.role, memberId: member._id }));
        res.json({ member });
    } catch (error) { next(error); }
}
