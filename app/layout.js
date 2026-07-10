import './globals.css';

export const metadata = {
  title: '家計簿ダッシュボード',
  description: 'Zaim / MoneyForward の取引を統合して月次で集計・可視化する家計簿アプリ',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
