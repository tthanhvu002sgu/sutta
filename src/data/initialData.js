// Initial sample sutta data
export const initialSuttas = [
  {
    id: 'dhp-1',
    title: 'Kinh Pháp Cú - Phẩm Song Yếu',
    subtitle: 'Dhammapada - Yamaka Vagga',
    createdAt: '2024-01-15',
    content: [
      {
        id: 'section-1',
        type: 'section',
        heading: 'I. Tâm Dẫn Đầu',
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            text: 'Tâm dẫn đầu các pháp, tâm làm chủ, tâm tạo tác. Nếu nói hoặc làm với tâm ô nhiễm, khổ não sẽ theo sau, như bánh xe lăn theo chân con vật kéo xe.'
          },
          {
            id: 'block-2',
            type: 'paragraph',
            text: 'Tâm dẫn đầu các pháp, tâm làm chủ, tâm tạo tác. Nếu nói hoặc làm với tâm trong sạch, an lạc sẽ theo sau, như bóng không rời hình.'
          }
        ]
      },
      {
        id: 'section-2',
        type: 'section',
        heading: 'II. Oán Hận và Từ Bi',
        blocks: [
          {
            id: 'block-3',
            type: 'paragraph',
            text: '"Nó mắng tôi, đánh tôi, nó thắng tôi, cướp của tôi." Ai ôm ấp tâm niệm ấy, hận thù không thể nguôi.'
          },
          {
            id: 'block-4',
            type: 'paragraph',
            text: '"Nó mắng tôi, đánh tôi, nó thắng tôi, cướp của tôi." Ai không ôm ấp tâm niệm ấy, hận thù liền tự nguôi.'
          },
          {
            id: 'block-5',
            type: 'paragraph',
            text: 'Ở đời không bao giờ dùng oán thù để diệt oán thù, chỉ có từ bi mới diệt oán thù. Đây là định luật nghìn thu.'
          }
        ]
      }
    ],
    annotations: {
      'block-1-0': { word: 'Tâm', note: 'Citta (Pali): Tâm thức, ý thức. Trong Abhidhamma, đây là nền tảng của mọi kinh nghiệm và hành động.' },
      'block-1-8': { word: 'pháp', note: 'Dhamma (Pali): Hiện tượng, sự vật. Ở đây chỉ mọi tư tưởng, lời nói và hành động.' },
      'block-2-6': { word: 'an lạc', note: 'Sukha (Pali): Hạnh phúc, niềm vui. Kết quả tự nhiên của tâm trong sạch và hành động thiện lành.' },
      'block-5-12': { word: 'từ bi', note: 'Mettā (Pali): Từ ái, tình thương vô điều kiện. Một trong Tứ Vô Lượng Tâm (Brahma-vihāra).' }
    }
  },
  {
    id: 'mn-1',
    title: 'Kinh Căn Bổn Pháp Môn',
    subtitle: 'Mūlapariyāya Sutta - MN 1',
    createdAt: '2024-01-20',
    content: [
      {
        id: 'section-1',
        type: 'section',
        heading: 'Lời Mở Đầu',
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            text: 'Như vầy tôi nghe. Một thời Thế Tôn trú ở Ukkaṭṭhā, tại rừng Subhaga, dưới gốc cây sāla to lớn.'
          },
          {
            id: 'block-2',
            type: 'paragraph',
            text: 'Ở đây Thế Tôn gọi các Tỷ-kheo: "Này các Tỷ-kheo!" — "Thưa vâng, bạch Thế Tôn!" Các Tỷ-kheo ấy vâng đáp Thế Tôn.'
          }
        ]
      }
    ],
    annotations: {
      'block-1-3': { word: 'Thế Tôn', note: 'Bhagavā (Pali): Thế Tôn, Đức Phật. Danh hiệu tôn kính dành cho Đức Phật Gautama.' }
    }
  }
];
