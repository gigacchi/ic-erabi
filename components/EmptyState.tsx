export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
      <p className="text-2xl">🔍</p>
      <p className="text-gray-700 font-medium">候補が見つかりませんでした</p>
      <p className="text-gray-500 text-sm">
        検索半径を広げるか、スマートICや条件を変更して再度お試しください。
      </p>
    </div>
  );
}
