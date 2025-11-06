# Acil Servis Görev Yönetimi

Next.js ve Redis kullanılarak geliştirilmiş acil servis için görev ve task yönetim uygulaması. Tüm veriler Redis'te saklanır ve 24 saat sonra otomatik olarak silinir.

## Özellikler

- Kullanıcı adı ile basit giriş/kayıt sistemi
- Oturum (Session) oluşturma ve yönetimi
- Hasta yönetimi (TC No ile)
- Hasta görevleri (Task) yönetimi
- Görevleri tamamlanmış olarak işaretleme
- Mobil odaklı responsive tasarım
- **24 saatlik otomatik veri temizleme** - Tüm veriler 24 saat sonra Redis'ten otomatik olarak silinir

## Kurulum

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Redis sunucusunu başlatın:
```bash
# Docker ile (önerilen)
docker run -d -p 6379:6379 redis:latest

# Windows (Redis for Windows kullanıyorsanız)
redis-server

# Linux/Mac
redis-server
```

3. Redis bağlantı URL'ini ayarlayın (opsiyonel):
```bash
# .env dosyası oluşturun (varsayılan: redis://localhost:6379)
REDIS_URL=redis://localhost:6379
```

4. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde çalışacaktır.

## Veritabanı

**Redis**: Tüm veriler (User, Session, Patient, Task) Redis'te saklanır ve 24 saat sonra otomatik olarak silinir.

### Redis Veri Yapısı

**User (Kullanıcı):**
- `user:{id}` - Kullanıcı bilgileri (JSON)
- `user:username:{username}` - Kullanıcı adı ile kullanıcı ID lookup
- `users:all` - Tüm kullanıcı ID'leri (sorted set)

**Session (Oturum):**
- `session:{id}` - Oturum bilgileri (JSON)
- `session:{id}:participants` - Oturum katılımcıları (set)
- `session:participant:{userId}:{sessionId}` - Katılımcı bilgisi (JSON)
- `user:{userId}:sessions` - Kullanıcının oturumları (set)
- `sessions:all` - Tüm oturum ID'leri (sorted set)

**Patient (Hasta):**
- `patient:{id}` - Hasta bilgileri (JSON)
- `patient:tc:{tcNo}` - TC No ile hasta ID lookup
- `patient:{id}:tasks` - Hasta görev ID'leri listesi
- `patients:all` - Tüm hasta ID'leri (sorted set)

**Task (Görev):**
- `task:{id}` - Görev bilgileri (JSON)

**Not:** Tüm key'ler 24 saat (86400 saniye) sonra otomatik olarak expire olur.

## Teknolojiler

- Next.js 15
- React 19
- Redis (Tüm veriler için)
- ioredis
- TypeScript
- Tailwind CSS



