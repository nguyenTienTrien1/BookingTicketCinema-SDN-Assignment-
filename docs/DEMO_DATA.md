# Du lieu demo

Chay tu thu muc goc du an:

```sh
npm run db:local -w backend
npm run seed:demo -w backend
```

Script doc `backend/.env` thong qua npm workspace, khong xoa database. Tai khoan, phong,
mon an va khuyen mai da ton tai duoc giu nguyen; mat khau khong bi reset. Phim da co chi
duoc bo sung classification va cac truong media/mo ta dang trong. Khong ho tro production.
Nen dung database local danh rieng cho demo. Khong chay dong thoi nhieu seed hoac thao tac
dat ghe trong khi seed dang chay.

## Tai khoan

Mat khau tai khoan **moi tao**: `Demo123456!`.

| Email | Vai tro / tinh huong |
| --- | --- |
| demo.admin@cinema.test | Quan tri phim, phong, ghe, lich chieu, mon an, khuyen mai, bao cao |
| demo.employee@cinema.test | Ban ve/bap nuoc tai quay, tra cuu thanh vien, check-in |
| demo.member@cinema.test | Thanh vien 300 diem, co lich su don mau |
| demo.vip@cinema.test | VIP, 1200 diem |
| demo.pending@cinema.test | Cho xac minh |
| demo.banned@cinema.test | Bi cam dang nhap |

Dia chi `.test` khong nhan email. Dang ky/xac minh/quen mat khau va Google OAuth can
cau hinh SMTP/Google that va tai khoan email that rieng.

## Du lieu

- 11 phim tu danh sach co san, anh poster/banner local, URL trailer tu `seedMovies.js`.
  Phim moi co ngay phat hanh tuong doi va classification; phim hien co giu trang thai.
  Trailer YouTube can Internet va co the bi gioi han nhung video tu ben ngoai.
- Hai rap: `Demo Cinema Central`, `Demo Cinema Riverside`. Moi rap co phong Standard
  80 ghe, VIP 48 ghe, phong bao tri va phong ngung hoat dong.
- Ghe A1 hong, A2 bao tri, A3 vo hieu hoa; mot so hang VIP de thu so do ghe.
- Lich tu hom nay den 6 ngay tiep theo, gio Viet Nam: 09:00, 13:00, 17:00, 21:00.
  Bo qua gio da qua; cac suat cach nhau 4 gio, gan roomId va sao chep cau hinh ghe.
- 6 mon an, gom ca hang sap het va het hang.
- `DEMO10`: giam 10% don tu 100k; `DEMOFOOD20`: giam 20% bap nuoc tu 50k;
  `DEMOTICKET30K`: giam 30k ve tu 160k. Tran giam 50k, khong cong don, hieu luc
  30 ngay tu lan tao dau tien. Seed lai khong gia han khuyen mai da co.
- Moi ngay seed tao toi da 3 don: da thanh toan mock, da huy, dang giu ghe 10 phut.
  Don paid co ve QR demo. Seed lai cung ngay khong reset don da thao tac.

## Thu luong demo

1. Admin: xem/sua phim va trailer, loc hai rap Demo, xem cau hinh ghe VIP va ghe loi;
   tao phong/lich moi, thu loi trung lich va phong bao tri.
2. Member: chon phim dang chieu, rap Demo, suat tuong lai, ghe hoat dong, bap nuoc;
   thu doi diem va thanh toan theo phuong thuc da cau hinh. Xem lich su/chi tiet ve.
3. Employee: tao don tai quay, tra cuu `demo.vip@cinema.test`, ap ma khuyen mai,
   thu tien mat va phat hanh ve. Thu don thieu tien, ma chua dat gia tri toi thieu,
   mon het hang. Tao don bap nuoc rieng de thu quan ly ton kho.
4. Check-in: dung ve thanh toan tien mat qua luong that, trong cua so check-in
   (mac dinh 30 phut truoc den 15 phut sau gio chieu). Thu quet lai ve da su dung.
5. Admin: xem bao cao theo ngay thu tien, loc nguon ve/bap nuoc va tien mat.

Don mock trong seed **khong phai chung tu thu tien**, khong tinh doanh thu va khong
duoc nang thanh ve vao rap that. De thu doanh thu/check-in, hoan tat buoc 3 bang
luong nghiep vu cua ung dung. VNPay, SMTP, Google OAuth van can cau hinh rieng;
seed khong thay doi `.env` hay bat mo phong thanh toan.
