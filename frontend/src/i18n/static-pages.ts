export interface StaticSection {
  heading: string;
  paragraphs: string[];
}

export interface StaticPage {
  title: string;
  intro: string;
  sections: StaticSection[];
}

// Wording must stay factual: no E2EE claim, no guaranteed delivery, no guaranteed rescue (spec 00-scope, v3.0 §26).
export const STATIC_PAGES = {
  about: {
    title: "Giới thiệu",
    intro: "Lịch Gia Đình giúp cả nhà cùng xem và sắp xếp lịch, việc cần làm, nhắc nhở và những ngày quan trọng.",
    sections: [
      {
        heading: "Dùng ngay, không cần tài khoản",
        paragraphs: [
          "Bạn có thể bắt đầu trên một thiết bị mà không cần đăng ký. Khi muốn dùng chung với người thân, bạn bật chia sẻ cho gia đình.",
        ],
      },
      {
        heading: "Hiển thị âm lịch",
        paragraphs: ["Ngày âm lịch được tính theo múi giờ Việt Nam (UTC+7). Sinh nhật, ngày giỗ có thể lặp lại theo âm lịch."],
      },
    ],
  },
  terms: {
    title: "Điều khoản sử dụng",
    intro: "Khi dùng Lịch Gia Đình, bạn đồng ý với các điều khoản dưới đây.",
    sections: [
      {
        heading: "Nhắc nhở và thông báo",
        paragraphs: [
          "Thông báo phụ thuộc vào trình duyệt, hệ điều hành và kết nối mạng của thiết bị. Ứng dụng không thể bảo đảm mọi thông báo đều tới đúng giờ.",
        ],
      },
      {
        heading: "SOS",
        paragraphs: [
          "SOS gửi cảnh báo tới người trong gia đình mà bạn đã chọn. Đây không phải dịch vụ cứu hộ và không thay thế việc gọi 113, 114, 115.",
        ],
      },
      {
        heading: "Sức khỏe và tài chính",
        paragraphs: ["Thông tin sức khỏe và tài chính chỉ để gia đình tự theo dõi, không thay thế tư vấn y tế hay tư vấn tài chính."],
      },
    ],
  },
  privacy: {
    title: "Quyền riêng tư",
    intro: "Mỗi không gian (gia đình hoặc nhóm) có một trong ba chế độ dữ liệu. Huy hiệu ở góc trên luôn cho biết chế độ hiện tại.",
    sections: [
      {
        heading: "Trên thiết bị (LOCAL_ONLY)",
        paragraphs: [
          "Dữ liệu chỉ lưu trong trình duyệt của thiết bị này. Ứng dụng không gửi tiêu đề, ghi chú, thành viên, tệp, dữ liệu sức khỏe hay tài chính lên máy chủ.",
          "Xóa dữ liệu trình duyệt, gỡ ứng dụng hoặc mất máy có thể làm mất dữ liệu. Hãy sao lưu định kỳ trong Cài đặt.",
        ],
      },
      {
        heading: "Đã chia sẻ (FAMILY_SHARE)",
        paragraphs: [
          "Dữ liệu được đồng bộ qua máy chủ để các thiết bị trong gia đình cùng xem. Máy chủ chỉ trả dữ liệu cho người có quyền theo vai trò.",
          "Mục đặt là Riêng tư chỉ người tạo xem được, kể cả chủ gia đình cũng không xem được.",
          "Dữ liệu được mã hóa khi truyền và tệp được mã hóa khi lưu trên máy chủ. Đây không phải mã hóa đầu cuối.",
        ],
      },
      {
        heading: "Đã bảo vệ & đồng bộ (ACCOUNT_BACKED)",
        paragraphs: ["Như chế độ chia sẻ, kèm tài khoản email để khôi phục khi đổi máy. Mã khôi phục chỉ hiện một lần, hãy cất ở nơi an toàn."],
      },
      {
        heading: "Giới hạn khi cài như ứng dụng (PWA)",
        paragraphs: [
          "Trên iPhone/iPad, thông báo chỉ hoạt động khi đã thêm ứng dụng vào Màn hình chính. Trình duyệt có thể xóa dữ liệu của trang ít dùng nếu thiết bị thiếu dung lượng.",
          "Không thể xóa từ xa dữ liệu trên một thiết bị đang ngoại tuyến. Thiết bị bị thu hồi chỉ ngừng nhận dữ liệu mới khi kết nối lại.",
        ],
      },
      {
        heading: "Nhắc nhở nhạy cảm",
        paragraphs: ["Nhắc nhở đánh dấu nhạy cảm chỉ hiện tiêu đề chung \"Lịch Gia Đình\" trên màn hình khóa và email."],
      },
    ],
  },
  contact: {
    title: "Liên hệ",
    intro: "Góp ý và báo lỗi xin gửi cho người quản trị gia đình hoặc nhà phát triển ứng dụng.",
    sections: [
      {
        heading: "Báo lỗi",
        paragraphs: ["Khi báo lỗi, đừng gửi kèm nội dung riêng tư của gia đình. Chỉ cần mô tả màn hình và thao tác gặp lỗi."],
      },
    ],
  },
  help: {
    title: "Trợ giúp",
    intro: "Một vài câu hỏi thường gặp.",
    sections: [
      {
        heading: "Làm sao để cả nhà cùng xem?",
        paragraphs: ["Vào Nhóm & Chia sẻ, bật chia sẻ cho gia đình rồi gửi lời mời bằng link hoặc mã QR. Chủ gia đình duyệt yêu cầu tham gia."],
      },
      {
        heading: "Mất điện thoại thì sao?",
        paragraphs: ["Nếu đã bật tài khoản hoặc lưu mã khôi phục, bạn đăng nhập lại trên máy mới. Nếu dữ liệu chỉ ở trên thiết bị, hãy khôi phục từ tệp sao lưu."],
      },
      {
        heading: "Chế độ người cao tuổi",
        paragraphs: ["Vào Cài đặt > Giao diện để bật chữ lớn và nút lớn."],
      },
    ],
  },
} satisfies Record<string, StaticPage>;

export type StaticPageKey = keyof typeof STATIC_PAGES;
