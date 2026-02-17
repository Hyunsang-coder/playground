import { Skull } from "lucide-react";

export default function Header() {
  return (
    <header className="flex flex-col items-center gap-2 sm:gap-3 pt-8 sm:pt-12 pb-4 sm:pb-6">
      <div className="flex items-center gap-2 sm:gap-3">
        <Skull className="h-8 w-8 sm:h-10 sm:w-10 text-kill" />
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          Kill<span className="text-kill">My</span>Idea
        </h1>
      </div>
      <p className="text-base sm:text-lg text-gray-400 text-center">
        당신의 아이디어를 냉정하게 검증합니다
      </p>
    </header>
  );
}
