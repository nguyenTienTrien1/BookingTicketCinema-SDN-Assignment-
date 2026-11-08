import { useEffect, useRef, useState } from 'react';
import { movieImageUrl } from '../services/movieService';
import FormFieldError from './FormFieldError';

export default function MovieImagePicker({ kind, value, file, error, fieldError, onFile, onUrl }) {
  const input = useRef(null);
  const [preview, setPreview] = useState('');
  const title = kind === 'poster' ? 'Poster' : 'Banner';
  useEffect(() => {
    if (!file) { setPreview(/^(https?:\/\/|\/(?!\/))/i.test(value) ? movieImageUrl(value) : ''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file, value]);
  return <section className={'movieWide movieImagePicker movieImagePicker-' + kind} aria-labelledby={'movie-' + kind + '-title'}>
    <h3 id={'movie-' + kind + '-title'}>{title}{kind === 'poster' ? ' *' : ''}</h3>
    <p className="movieFormHint">{kind === 'poster' ? 'Ảnh dọc, gợi ý tỷ lệ 2:3.' : 'Ảnh ngang, gợi ý tỷ lệ 16:9.'} JPG, PNG hoặc WebP, tối đa 5 MB.</p>
    <div className="movieImageActions">
      <button className="movieSecondary" type="button" onClick={() => input.current?.click()}>Chọn {kind} từ máy tính</button>
      <input ref={input} id={'movie-' + kind + '-file'} type="file" accept="image/jpeg,image/png,image/webp" className="movieSrOnly" aria-label={'Chọn ảnh ' + kind} onChange={event => { onFile(event.target.files?.[0] || null); event.target.value = ''; }} />
      {file && <span>{file.name}</span>}
      {(file || error) && <button className="movieSecondary" type="button" onClick={() => { onFile(null); input.current.value = ''; }}>Bỏ chọn {kind}</button>}
    </div>
    {error && <p className="movieError" role="alert">{error}</p>}
    <div className="movieImagePreview">{preview ? <img src={preview} alt={'Xem trước ' + kind} onError={event => { event.currentTarget.style.display = 'none'; }} onLoad={event => { event.currentTarget.style.display = ''; }} /> : <span>Chưa chọn ảnh</span>}</div>
    <details className="adminMediaUrl"><summary>Hoặc nhập đường dẫn {kind}</summary><label htmlFor={'movie-' + kind}>Đường dẫn {kind}
      <input id={'movie-' + kind} name={kind} value={value} onChange={onUrl} disabled={!!file} required={kind === 'poster' && !file} maxLength={2048} placeholder={'https://… hoặc /images/' + kind + 's/…'} />
      <FormFieldError error={fieldError} />
    </label></details>
  </section>;
}
