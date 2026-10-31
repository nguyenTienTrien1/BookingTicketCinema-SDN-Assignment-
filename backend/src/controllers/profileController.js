import * as profileService from '../services/profileService.js';

export async function view(req, res, next) {
  try {
    const user = await profileService.getProfile(req.user._id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
