import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import SeatLayoutEditor, {
  conditionLabels,
} from "../../components/SeatLayoutEditor";
import {
  getRoomSeats,
  previewRoomSeats,
  saveRoomSeats,
} from "../../services/roomService";
import "./movies.css";
import "./rooms.css";

export default function ConfigureSeats() {
  const { id } = useParams();
  const [room, setRoom] = useState(null),
    [seats, setSeats] = useState([]),
    [configs, setConfigs] = useState({});
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [reload, setReload] = useState(0);
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [review, setReview] = useState(null);
  const submitting = useRef(false),
    reviewRef = useRef(null),
    errorRef = useRef(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReview(null);
    getRoomSeats(id)
      .then((data) => {
        if (active) {
          setRoom(data);
          setSeats(data.seats);
          setConfigs(data.seatConfigs);
        }
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, reload]);
  useEffect(() => {
    if (review) reviewRef.current?.focus();
  }, [review]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  function change(nextSeats, nextConfigs) {
    setSeats(nextSeats);
    setConfigs(nextConfigs);
    setReview(null);
    setMessage("");
    setError("");
  }
  async function preview() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await previewRoomSeats(id, {
        version: room.version,
        seats,
        seatConfigs: configs,
      });
      setReview(data.review);
    } catch (err) {
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  async function save() {
    if (submitting.current || !review?.canSave) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      const data = await saveRoomSeats(id, {
        version: room.version,
        seats,
        seatConfigs: configs,
      });
      setRoom(data.room);
      setSeats(data.room.seats);
      setConfigs(data.room.seatConfigs);
      setReview(null);
      setMessage(data.message);
    } catch (err) {
      setReview(null);
      setError(err.message);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <main className="movieAdmin roomAdmin">
      <div className="movieAdminShell roomSeatShell">
        <Link className="movieBack" to="/admin/rooms">
          ← Danh sách phòng chiếu
        </Link>
        <header className="movieAdminHeading">
          <div>
            <p className="movieEyebrow">CINEMA+ / CẤU HÌNH GHẾ</p>
            <h1>Sơ đồ ghế</h1>
            {room && (
              <p>
                {room.cinema} · <strong>{room.name}</strong>
              </p>
            )}
          </div>
        </header>
        {message && (
          <p className="movieSuccess" role="status">
            {message}
          </p>
        )}
        {error && (
          <div className="movieError" role="alert" ref={errorRef} tabIndex={-1}>
            <p>{error}</p>
            <button
              className="movieSecondary"
              disabled={busy}
              onClick={() => {
                setMessage("");
                setReload((value) => value + 1);
              }}
            >
              Tải lại phòng và bỏ bản nháp
            </button>
          </div>
        )}
        {loading && (
          <p className="movieState" role="status">
            Đang tải sơ đồ ghế…
          </p>
        )}
        {!loading && room && (
          <>
            <p className="movieWarning">
              {room.layoutPolicy} Ghế đang giữ hoặc có vé được bảo vệ sẽ chặn
              thay đổi không an toàn.
            </p>
            <section
              className="moviePanel roomEditorPanel"
              aria-label="Chỉnh sửa sơ đồ"
            >
              <SeatLayoutEditor
                key={`${id}:${room.version}`}
                seats={seats}
                configs={configs}
                onChange={change}
                disabled={busy}
              />
            </section>
            <div className="roomEditorActions">
              <Link className="movieSecondary" to="/admin/rooms">
                Hủy và về danh sách
              </Link>
              <button
                className="moviePrimary roomAction roomActionEdit"
                disabled={busy}
                onClick={preview}
              >
                {busy ? "Đang kiểm tra…" : "Xem lại thay đổi"}
              </button>
            </div>
            {review && (
              <section
                className="moviePanel roomReview"
                aria-labelledby="seat-review-title"
              >
                <h2 id="seat-review-title" ref={reviewRef} tabIndex={-1}>
                  Xem lại thay đổi
                </h2>
                <p>
                  Sức chứa:{" "}
                  <strong>
                    {review.before} → {review.after} ghế
                  </strong>{" "}
                  · {review.scheduledShowtimes} suất chưa kết thúc
                </p>
                <div className="roomReviewGrid">
                  <div>
                    <h3>Ghế thêm ({review.added.length})</h3>
                    <p>{review.added.join(", ") || "Không có"}</p>
                  </div>
                  <div>
                    <h3>Ghế xóa ({review.removed.length})</h3>
                    <p>{review.removed.join(", ") || "Không có"}</p>
                  </div>
                  <div>
                    <h3>Đổi loại ({review.types.length})</h3>
                    {review.types.length ? (
                      <ul>
                        {review.types.map((change) => (
                          <li key={change.seat}>
                            {change.seat}:{" "}
                            <span
                              className={`roomTypeChip roomType${change.before}`}
                            >
                              {change.before}
                            </span>{" "}
                            →{" "}
                            <span
                              className={`roomTypeChip roomType${change.after}`}
                            >
                              {change.after}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Không có</p>
                    )}
                  </div>
                  <div>
                    <h3>Đổi tình trạng ({review.conditions.length})</h3>
                    {review.conditions.length ? (
                      <ul>
                        {review.conditions.map((change) => (
                          <li key={change.seat}>
                            {change.seat}:{" "}
                            <span
                              className={`roomStatus roomStatus${change.before}`}
                            >
                              {conditionLabels[change.before]}
                            </span>{" "}
                            →{" "}
                            <span
                              className={`roomStatus roomStatus${change.after}`}
                            >
                              {conditionLabels[change.after]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>Không có</p>
                    )}
                  </div>
                </div>
                {review.conflicts.length > 0 ? (
                  <div className="movieError" role="alert">
                    <strong>Không thể lưu cấu hình này</strong>
                    <ul>
                      {review.conflicts.map((conflict, index) => (
                        <li key={index}>{conflict}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="movieSuccess">
                    Không phát hiện xung đột tại thời điểm kiểm tra. Hệ thống sẽ
                    kiểm tra lại khi lưu.
                  </p>
                )}
                <div className="movieFormActions">
                  <button
                    className="movieSecondary"
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Quay lại chỉnh sửa
                  </button>
                  <button
                    className="moviePrimary roomAction roomActionSave"
                    disabled={busy || !review.canSave}
                    onClick={save}
                  >
                    {busy ? "Đang lưu…" : "Xác nhận và lưu"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
