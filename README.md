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
