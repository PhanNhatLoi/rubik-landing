import React from 'react'

const ITEMS = [
  {
    id: 'learn',
    title: 'Học chơi Rubik',
    desc: 'Hướng dẫn từng chương, luyện tập ngay trên khối 3D.',
    icon: (
      <>
        <path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z" />
        <path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    id: 'scan',
    title: 'Quét Rubik',
    desc: 'Bật webcam hoặc chụp ảnh để nhận diện khối thật.',
    icon: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
  },
  {
    id: 'solve',
    title: 'Giải',
    desc: 'Giải khối 3D đang hiển thị: giải nhanh hoặc cơ bản.',
    icon: (
      <>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" />
      </>
    ),
  },
]

export default function MenuList({ onOpenSection }) {
  return (
    <div className="rb-menu">
      {ITEMS.map((item) => (
        <button key={item.id} type="button" className="rb-menu__item" onClick={() => onOpenSection(item.id)}>
          <span className="rb-menu__icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.icon}
            </svg>
          </span>
          <span className="rb-menu__text">
            <span className="rb-menu__title">{item.title}</span>
            <span className="rb-menu__desc">{item.desc}</span>
          </span>
          <span className="rb-menu__chevron" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  )
}

export const SECTION_TITLES = { learn: 'Học chơi Rubik', scan: 'Quét Rubik', solve: 'Giải' }
