import { Skull } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-col items-center gap-3 pt-12 pb-6">
      <div className="flex items-center gap-3">
        <Skull className="h-10 w-10 text-kill" />
        <h1 className="text-4xl font-black tracking-tight">
          Kill<span className="text-kill">My</span>Idea
        </h1>
      </div>
      <p className="text-lg text-gray-400">
        당신의 아이디어를 냉정하게 검증합니다
      </p>
    </header>
  );
}
