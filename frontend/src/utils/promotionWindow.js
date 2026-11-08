const VN_OFFSET = 7 * 60 * 60 * 1000;
export const vietnamToday = (now = new Date()) => new Date(now.getTime() + VN_OFFSET).toISOString().slice(0, 10);
export const vietnamMinute = value => new Date(new Date(value).getTime() + VN_OFFSET).toISOString().slice(0, 16);
export const displayDay = value => value.slice(0, 10).split('-').reverse().join('/');

export function shiftDay(value, days) {
  const date = new Date(value + 'T00:00:00.000Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Ngày khuyến mãi không hợp lệ.');
  date.setUTCDate(date.getUTCDate() + days);
  const result = date.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new Error('Ngày khuyến mãi vượt phạm vi cho phép.');
  return result;
}
export function readPromotionWindow(startsAt, endsAt) {
  const start = new Date(startsAt), end = new Date(endsAt);
  const startLocal = new Date(start.getTime() + VN_OFFSET).toISOString();
  const endLocal = new Date(end.getTime() + VN_OFFSET).toISOString();
  const wholeDays = startLocal.endsWith('T00:00:00.000Z') && endLocal.endsWith('T00:00:00.000Z') && start < end;
  return { specificTime: !wholeDays, startsAt: wholeDays ? startLocal.slice(0, 10) : startLocal.slice(0, 16), endsAt: wholeDays ? shiftDay(endLocal.slice(0, 10), -1) : endLocal.slice(0, 16), rawStartsAt: startsAt, rawEndsAt: endsAt };
}
export function promotionWindowPayload(form, specificTime, original) {
  if (!form.startsAt || !form.endsAt) throw new Error('Vui lòng chọn ngày bắt đầu và kết thúc.');
  let startsAt, endsAt;
  if (!specificTime) {
    shiftDay(form.startsAt, 0);
    startsAt = form.startsAt + 'T00:00:00+07:00';
    endsAt = shiftDay(form.endsAt, 1) + 'T00:00:00+07:00';
  } else {
    if (![form.startsAt, form.endsAt].every(value => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))) throw new Error('Thời gian khuyến mãi không hợp lệ.');
    startsAt = original?.specificTime && original.startsAt === form.startsAt ? original.rawStartsAt : form.startsAt + ':00+07:00';
    endsAt = original?.specificTime && original.endsAt === form.endsAt ? original.rawEndsAt : form.endsAt + ':00+07:00';
    if (vietnamMinute(startsAt) !== form.startsAt || vietnamMinute(endsAt) !== form.endsAt) throw new Error('Thời gian khuyến mãi không hợp lệ.');
  }
  if (new Date(startsAt) >= new Date(endsAt)) throw new Error('Ngày hoặc giờ kết thúc phải sau thời gian bắt đầu.');
  return { startsAt, endsAt };
}
export function switchPromotionWindow(form, specificTime) {
  if (specificTime) return { startsAt: form.startsAt ? form.startsAt + 'T00:00' : '', endsAt: form.endsAt ? shiftDay(form.endsAt, 1) + 'T00:00' : '' };
  const start = form.startsAt.slice(0, 10);
  let end = form.endsAt.slice(0, 10);
  if (form.endsAt.endsWith('T00:00')) end = shiftDay(end, -1);
  if (start && end && end < start) end = start;
  return { startsAt: start, endsAt: end };
}
