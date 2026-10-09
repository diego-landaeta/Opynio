import type { LegalContent } from '../types';

// Ban tieng Viet. Dich tu es.ts; neu co khac biet, ban tieng Tay Ban Nha duoc uu tien.
const vi: LegalContent = {
    actualizado: 'Cập nhật lần cuối',
    nota: 'Bản dịch này chỉ nhằm mục đích cung cấp thông tin. Nếu có bất kỳ khác biệt nào, bản tiếng Tây Ban Nha được ưu tiên áp dụng.',
    enlaces: {
        contacto: 'biểu mẫu liên hệ',
        soporte: 'Hỗ trợ',
        privacidad: 'chính sách quyền riêng tư',
        terminos: 'Điều khoản sử dụng',
        avisoLegal: 'Thông báo pháp lý',
    },

    privacidad: {
        titulo: 'Quyền riêng tư và cookie',
        meta: 'Cách Opynio xử lý dữ liệu cá nhân của bạn và những cookie mà Opynio sử dụng.',
        secciones: [
            { t: 'Ai xử lý dữ liệu của bạn', p: [
                'Opynio, nền tảng đánh giá doanh nghiệp trên trang web này. Mọi thắc mắc về dữ liệu của bạn, hãy viết cho chúng tôi qua {contacto}.',
            ] },
            { t: 'Chúng tôi xử lý những dữ liệu nào', p: [
                'Nếu bạn tạo tài khoản: tên, tên người dùng, email, ảnh hồ sơ (không bắt buộc) và các tùy chọn của bạn về ngôn ngữ, quốc gia, giao diện và thông báo.',
                'Nội dung bạn đăng: đánh giá, ảnh hoặc âm thanh bạn đính kèm, lượt bình chọn và phản hồi. Đánh giá được công khai và có thể được hiển thị trên trang web của doanh nghiệp được đánh giá thông qua các widget của chúng tôi.',
                'Nếu bạn quản lý một doanh nghiệp: thông tin trên trang của doanh nghiệp đó và, nếu bạn đăng ký một gói, dữ liệu thanh toán do Stripe quản lý (Opynio không lưu thông tin thẻ của bạn).',
                'Nội dung bạn gửi cho chúng tôi qua Hỗ trợ hoặc biểu mẫu liên hệ.',
            ] },
            { t: 'Mục đích và cơ sở pháp lý', p: [
                'Cung cấp dịch vụ bạn yêu cầu: tài khoản của bạn, đăng và kiểm duyệt đánh giá, quản lý doanh nghiệp và các khoản thanh toán của bạn.',
                'Bảo mật và phòng chống lạm dụng (đánh giá giả mạo, spam), dựa trên lợi ích chính đáng của chúng tôi.',
                'Thông báo qua email về hoạt động của bạn (phản hồi từ bộ phận hỗ trợ, đánh giá mới về doanh nghiệp của bạn). Bạn có thể tắt chúng trong Cài đặt.',
                'Đo lường các chiến dịch của chúng tôi với Meta, chỉ khi bạn chấp nhận cookie đo lường và quảng cáo.',
            ] },
            { t: 'Dữ liệu được chia sẻ với ai', p: [
                'Với các nhà cung cấp mà chúng tôi cần để vận hành: Supabase (lưu trữ và cơ sở dữ liệu), Stripe (thanh toán), nhà cung cấp dịch vụ gửi email của chúng tôi và, chỉ khi có sự cho phép của bạn, Meta. Chúng tôi không bán dữ liệu của bạn.',
            ] },
            { t: 'Thời gian lưu trữ', p: [
                'Trong suốt thời gian bạn còn giữ tài khoản. Nếu bạn yêu cầu xóa tài khoản, chúng tôi sẽ xóa dữ liệu của bạn, trừ những dữ liệu mà pháp luật buộc chúng tôi phải lưu giữ (ví dụ: hóa đơn).',
            ] },
            { t: 'Quyền của bạn', p: [
                'Bạn có thể yêu cầu truy cập, chỉnh sửa, xóa, phản đối, hạn chế xử lý và chuyển dữ liệu của mình qua {soporte} hoặc {contacto}. Nếu không hài lòng, bạn có thể khiếu nại lên Cơ quan Bảo vệ Dữ liệu Tây Ban Nha (aepd.es).',
            ] },
        ],
        cookies: {
            t: 'Cookie',
            intro: 'Chúng tôi sử dụng bộ nhớ trình duyệt của bạn để trang web hoạt động và, chỉ khi bạn chấp nhận, cookie của Meta để đo lường các chiến dịch của chúng tôi.',
            filas: [
                ['Cần thiết (luôn bật)', 'Duy trì phiên đăng nhập và ghi nhớ các tùy chọn của bạn: ngôn ngữ, quốc gia, giao diện và lựa chọn của bạn về cookie.'],
                ['Đo lường và quảng cáo (không bắt buộc)', 'Meta Pixel (_fbp, _fbc). Chỉ được kích hoạt nếu bạn chấp nhận trong thông báo cookie hoặc trong Cài đặt › Quyền riêng tư.'],
            ],
            boton: 'Cài đặt cookie',
        },
    },

    avisoLegal: {
        titulo: 'Thông báo pháp lý',
        meta: 'Thông tin về chủ sở hữu Opynio và các điều kiện sử dụng trang web.',
        secciones: [
            { t: 'Chủ sở hữu trang web',
              intro: 'Theo Luật 34/2002 của Tây Ban Nha về dịch vụ xã hội thông tin và thương mại điện tử (LSSI-CE), sau đây là thông tin về chủ sở hữu của trang web này:',
              p: [
                'Chủ sở hữu: {titular}',
                'Mã số thuế (NIF): {nif}',
                'Địa chỉ: {domicilio}',
                'Thông tin đăng ký: {registro}',
                'Email: {email}',
                'Trang web: {web}',
            ] },
            { t: 'Mục đích', p: [
                'Opynio là nền tảng nơi người dùng đăng đánh giá về các doanh nghiệp, còn các doanh nghiệp quản lý trang của mình, trả lời đánh giá và có thể hiển thị chúng trên trang web của mình thông qua widget. Việc sử dụng trang web đồng nghĩa với việc bạn chấp nhận thông báo pháp lý này và {terminos}.',
            ] },
            { t: 'Sở hữu trí tuệ và sở hữu công nghiệp', p: [
                'Thiết kế, mã nguồn, thương hiệu Opynio và nội dung riêng của trang web thuộc về chủ sở hữu trang web hoặc các bên thứ ba đã cho phép sử dụng. Không được sao chép, phân phối hoặc chỉnh sửa khi chưa được phép, trừ trường hợp sử dụng cá nhân và riêng tư.',
                'Đánh giá thuộc về người viết; người viết cấp cho Opynio giấy phép đăng tải đánh giá, như được giải thích trong {terminos}.',
                'Tên và nhãn hiệu của các doanh nghiệp được đánh giá thuộc về chủ sở hữu tương ứng.',
            ] },
            { t: 'Trách nhiệm', p: [
                'Đánh giá thể hiện ý kiến của người viết, không phải của Opynio. Chúng tôi kiểm duyệt nội dung để gỡ bỏ những nội dung vi phạm quy tắc của chúng tôi hoặc pháp luật, nhưng không thể bảo đảm tính chính xác của từng ý kiến. Opynio không chịu trách nhiệm về thiệt hại phát sinh từ việc sử dụng trang web không đúng cách, cũng như về nội dung của các trang web bên thứ ba được liên kết từ trang web này.',
            ] },
            { t: 'Nội dung bất hợp pháp', p: [
                'Nếu bạn cho rằng một nội dung được đăng trên Opynio là bất hợp pháp hoặc xâm phạm quyền của bạn, hãy báo cho chúng tôi qua {soporte} hoặc {contacto} và chúng tôi sẽ xem xét sớm nhất có thể.',
            ] },
            { t: 'Bảo vệ dữ liệu', p: [
                'Cách chúng tôi xử lý dữ liệu cá nhân của bạn được giải thích trong {privacidad}.',
            ] },
            { t: 'Luật áp dụng', p: [
                'Thông báo pháp lý này được điều chỉnh bởi pháp luật Tây Ban Nha. Mọi tranh chấp sẽ thuộc thẩm quyền của các tòa án có thẩm quyền theo quy định của pháp luật; nếu bạn là người tiêu dùng, là tòa án nơi bạn cư trú.',
            ] },
        ],
    },

    terminos: {
        titulo: 'Điều khoản sử dụng',
        meta: 'Các điều kiện để sử dụng Opynio với tư cách người dùng hoặc doanh nghiệp: tài khoản, đánh giá, gói dịch vụ và quy định.',
        secciones: [
            { t: 'Chấp nhận', p: [
                'Các điều khoản này điều chỉnh việc người dùng và doanh nghiệp sử dụng Opynio. Khi tạo tài khoản hoặc sử dụng dịch vụ, bạn chấp nhận các điều khoản này; nếu không đồng ý, vui lòng không sử dụng nền tảng. Các điều khoản này bổ sung cho {avisoLegal} và {privacidad}.',
            ] },
            { t: 'Tài khoản của bạn', p: [
                'Bạn cần có tài khoản để viết đánh giá hoặc quản lý doanh nghiệp. Bạn phải đủ độ tuổi tối thiểu theo quy định pháp luật của quốc gia bạn (tại Tây Ban Nha là 14 tuổi), cung cấp thông tin trung thực và giữ an toàn cho mật khẩu của mình. Bạn chịu trách nhiệm về mọi hoạt động được thực hiện từ tài khoản của mình.',
            ] },
            { t: 'Đánh giá', p: [
                'Chỉ viết về trải nghiệm thực tế với doanh nghiệp được đánh giá, với thái độ tôn trọng và không đưa dữ liệu cá nhân của người khác vào.',
                'Không cho phép đánh giá giả mạo hoặc được trả tiền, đánh giá về doanh nghiệp của chính bạn hoặc của đối thủ cạnh tranh, cũng như nội dung xúc phạm, phân biệt đối xử, bất hợp pháp hoặc mang tính quảng cáo.',
                'Đánh giá vẫn thuộc về bạn, nhưng khi đăng, bạn cấp cho Opynio giấy phép miễn phí, có hiệu lực trên toàn thế giới và không độc quyền để hiển thị chúng trên nền tảng và trong các widget mà doanh nghiệp nhúng vào trang web của họ, trong thời gian đánh giá còn được đăng.',
                'Chúng tôi có thể kiểm duyệt, ẩn hoặc gỡ bỏ những đánh giá vi phạm các điều khoản này. Bạn có thể chỉnh sửa hoặc xóa đánh giá của mình từ hồ sơ của bạn.',
            ] },
            { t: 'Doanh nghiệp', p: [
                'Người nhận quyền sở hữu hoặc quản lý trang của một doanh nghiệp cam đoan rằng mình được ủy quyền đại diện cho doanh nghiệp đó.',
                'Doanh nghiệp có thể trả lời đánh giá, nhưng không được sửa đổi đánh giá, yêu cầu gỡ đánh giá để đổi lấy bất kỳ lợi ích nào, hoặc đưa ra ưu đãi để đổi lấy đánh giá tích cực.',
                'Widget hiển thị đánh giá đúng như khi được đăng trên Opynio.',
            ] },
            { t: 'Gói dịch vụ và thanh toán', p: [
                'Một số tính năng yêu cầu gói trả phí. Giá và điều kiện được hiển thị trước khi bạn đăng ký, và việc thanh toán do Stripe xử lý. Bạn có thể hủy gia hạn bất cứ lúc nào từ bảng điều khiển của mình; gói vẫn có hiệu lực đến hết kỳ đã thanh toán.',
            ] },
            { t: 'Các hành vi không được phép', p: [
                'Không được sử dụng Opynio để gửi spam, thu thập dữ liệu tự động khi chưa được phép, mạo danh người hoặc doanh nghiệp khác, hoặc can thiệp vào hoạt động của dịch vụ.',
            ] },
            { t: 'Tạm ngưng và đóng tài khoản', p: [
                'Chúng tôi có thể tạm ngưng hoặc đóng các tài khoản vi phạm các điều khoản này. Bạn có thể yêu cầu xóa tài khoản của mình bất cứ lúc nào qua {soporte}.',
            ] },
            { t: 'Trách nhiệm', p: [
                'Chúng tôi cố gắng để dịch vụ luôn sẵn sàng và hoạt động không có lỗi, nhưng không thể bảo đảm điều đó vào mọi thời điểm. Opynio không chịu trách nhiệm về ý kiến của người dùng hoặc về các mối quan hệ giữa người dùng và doanh nghiệp.',
            ] },
            { t: 'Thay đổi điều khoản', p: [
                'Chúng tôi có thể cập nhật các điều khoản này. Nếu có thay đổi quan trọng, chúng tôi sẽ thông báo cho bạn. Ngày cập nhật gần nhất được hiển thị ở đầu trang này.',
            ] },
            { t: 'Luật áp dụng', p: [
                'Các điều khoản này được điều chỉnh bởi pháp luật Tây Ban Nha. Nếu bạn là người tiêu dùng, bạn vẫn giữ các quyền mà pháp luật của quốc gia nơi bạn cư trú dành cho bạn. Nếu có bất kỳ thắc mắc nào, hãy viết cho chúng tôi qua {soporte} hoặc {contacto}.',
            ] },
        ],
    },
};

export default vi;
