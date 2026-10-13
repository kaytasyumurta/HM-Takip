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

## Aşama 3 (başvuru-onay, 15 gün deneme, tedarik modülü)
1. Supabase > SQL Editor: `supabase/asama3.sql` dosyasının TAMAMINI yapıştırıp Run (Aşama 1 ve 2 daha önce çalıştırılmış olmalı).
2. Dosyaları GitHub'a yükle (main dalına), Vercel otomatik dağıtır.

### Yeni kayıt akışı
Kullanıcı: firma kodu > hesap oluştur > başvuru yapar. Firma yöneticisi: Kullanıcılar sayfasında başvuruyu görür, rol seçip Onayla/Reddet der. Yönetici e-posta girmez.
İlk firma yöneticisi için: süper yönetici firma detayında "Kullanıcılar" sekmesinden başvuruyu onaylar ya da e-posta ile ekler.

### Hız (önemli)
Vercel > Project Settings > Functions > Function Region: Supabase projenizle AYNI bölgeyi seçin
(Supabase > Project Settings > General > Region). Varsayılan ABD (Washington) ise ve Supabase Avrupa'daysa her sayfa geçişi gecikir.
Değişiklikten sonra Redeploy yapın.

### Test listesi
- Süper yönetici yeni firma oluştursun: bitiş tarihi tam 15 gün sonra olmalı (formda gün alanı yok).
- Başka bir hesapla firma koduyla başvur: yönetici ekranında görünmeli, onaylanınca giriş yapabilmeli.
- A firmasının kullanıcısı B firmasının tedarik/tedarikçi/ürün kayıtlarını göremez ve ekleyemez.
- Nakliye modeli "dahil" iken ayrı nakliye bedeli kaydedilemez. "Belirsiz" iken kayıt yapılabilir, sonra "ayrı bedel"e çevrilince geçmişte görünür.
- Lisansı biten firmada tedarik sayfaları veri döndürmez (kilit ekranı çıkar).

## Aşama 4 (kantar modülü)
1. Supabase > SQL Editor: `supabase/asama4.sql` dosyasının TAMAMINI yapıştırıp Run (Aşama 1-3 daha önce çalıştırılmış olmalı).
2. Dosyaları GitHub'a yükle (main), Vercel otomatik dağıtır.

### Test listesi
- 1.000 tonluk tedarik aç. Kantarda 32,5 ton onaylı kayıt gir: tedarikte gerçekleşen 32,5, kalan 967,5, %3 görünmeli (araç sayısı 1).
- Kaydı Beklemede yap: tonaja eklenmemeli. Onayla: eklenmeli. İptal et ya da sil: toplam geri düşmeli.
- Toplamı geçecek kayıt gir: "fazla teslimat" uyarısı. Hedefe ulaşınca tedarik otomatik "Tamamlandı" olmalı; tamamlanmış tedariğe kayıt eklenmeye çalışılınca engellenmeli, "Yeniden aç" ile açılabilmeli.
- Aynı plakaya sonra %5'ten farklı dara gir: "Dara!" uyarısı çıkmalı.
- Kantar personeli hesabıyla: kayıt ekleyebilmeli, onaylanmış kaydı değiştirememeli/silememeli.
- A firmasının kullanıcısı B firmasının kantar kayıtlarını göremez.
