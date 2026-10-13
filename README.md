# Tedarik ve Kantar Takip - Aşama 1 (çok firmalı temel + süper yönetici)

## Kurulum
1. supabase.com > yeni proje. SQL Editor'e `supabase/schema.sql` dosyasının TAMAMINI yapıştırıp Run.
2. Authentication > Providers > Email: "Confirm email" seçeneğini kapat.
3. Project Settings > API: Project URL ve anon public key'i kopyala.
4. Klasörü GitHub'a yükle, vercel.com'da o depoyu içe aktar.
5. Vercel > Environment Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY. Deploy.
6. ÖNEMLİ: Siteyi açıp "Süper yönetici girişi" > "Hesap oluştur" ile İLK hesabı KENDİN oluştur. İlk kayıt otomatik süper yönetici olur. Bu yüzden siteyi başkasına vermeden önce bunu yap.

## Test listesi (veri izolasyonu)
1. Süper yönetici ile iki firma oluştur (ör. A ve B).
2. İki farklı e-postayla iki hesap oluştur (firma seçim ekranından firma kodu girip "Hesap oluştur").
3. Süper yönetici panelinden birinci hesabı A'ya, ikinciyi B'ye "Firma Yöneticisi" olarak ekle.
4. A yöneticisi ile giriş yap: sadece A'yı ve A'nın kullanıcılarını görmeli.
5. A hesabıyla B'nin firma koduyla girmeyi dene: "üyeliğiniz yok" demeli.
6. Süper yönetici panelinde bir firmanın lisans bitiş tarihini geçmişe al: o firma kullanıcıları "Lisans süresi doldu" ekranını görmeli.

## Tasarım güncellemesi (v2)
- Koyu lacivert modern arayüz: üst çubuk, açılır/kapanır sol menü, kartlar, arama/filtre çubuğu, durum rozetleri.
- Üstteki güneş/ay simgesiyle açık-koyu tema geçişi.
- Ürün adı ve alt başlığı `lib/brand.js` dosyasından değiştirilebilir.
- Yeni bağımlılık: lucide-react (Vercel otomatik kurar). Veritabanı değişmedi, SQL'i tekrar çalıştırmaya gerek yok.

## Aşama 2 (lisans anahtarları)
1. Supabase > SQL Editor: `supabase/asama2.sql` dosyasının TAMAMINI yapıştırıp Run (Aşama 1 SQL'i daha önce çalıştırılmış olmalı).
2. Dosyaları GitHub'a yükle, Vercel otomatik dağıtır.
3. Süper yönetici panelinde: Lisans Anahtarları > Yeni anahtar oluştur. Anahtar yalnızca oluşturulurken bir kez gösterilir.
4. Yeni kullanıcı: firma kodu > hesap oluştur > aktivasyon kodunu gir. Firma yöneticisi: Lisans sayfasından uzatma anahtarını girer.

### Test listesi
- A firması için uzatma anahtarı üret, B firmasının yöneticisiyle girmeyi dene: reddedilmeli.
- Aynı anahtarı ikinci kez gir: reddedilmeli.
- Lisans süresi bitmemişken uzat: yeni bitiş = eski bitiş + gün. Süre dolmuşken uzat: bugün + gün.
- Üst üste 5 hatalı anahtar: 15 dakika bekletme mesajı. İşlem Kayıtları'nda "Hatalı anahtar denemesi" görünmeli.
- Süresi dolan firmanın yöneticisi, kilit ekranından anahtar girip devam edebilmeli. Verileri silinmemeli.
