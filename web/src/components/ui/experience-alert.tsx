"use client";

import { useState, useEffect } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUp, SparklesIcon } from "lucide-react";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

// 경험치 알림 타입
interface ExpAlertProps {
  show: boolean;
  onClose: () => void;
  xp: number;
  message?: string;
  type: "gain" | "levelup";
  oldLevel?: number;
  newLevel?: number;
}

// 경험치 획득 알림
export function ExpGainAlert({ show, onClose, xp, message }: Omit<ExpAlertProps, "type" | "oldLevel" | "newLevel"> & { type?: "gain" }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-primary text-white p-4 rounded-lg shadow-lg flex gap-3 items-center animate-in slide-in-from-bottom-5 duration-300 z-50">
      <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center flex-shrink-0">
        <SparklesIcon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h4 className="font-medium text-sm">경험치 획득!</h4>
        <p className="text-xs text-primary-foreground/80">{message || "활동에 대한 보상을 받았습니다"}</p>
      </div>
      <Badge variant="outline" className="text-white border-white/30 ml-auto whitespace-nowrap">
        +{xp} EXP
      </Badge>
    </div>
  );
}

// 레벨업 알림
export function LevelUpAlert({ show, onClose, xp, oldLevel, newLevel }: Omit<ExpAlertProps, "type" | "message"> & { type?: "levelup" }) {
  const { width, height } = useWindowSize();
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (show) {
      setShowConfetti(true);
      const timer = setTimeout(() => {
        setShowConfetti(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!show) return null;

  return (
    <>
      {showConfetti && <Confetti width={width} height={height} recycle={false} numberOfPieces={500} />}
      <AlertDialog open={show} onOpenChange={(open) => !open && onClose()}>
        <AlertDialogContent className="max-w-md text-center p-0 overflow-hidden">
          <div className="bg-primary text-white py-6 px-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary-foreground/20 flex items-center justify-center mb-3">
              <ArrowUp className="h-10 w-10" />
            </div>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-2xl font-bold tracking-tight">
                레벨업!
              </AlertDialogTitle>
              <AlertDialogDescription className="text-primary-foreground/80">
                축하합니다! 레벨이 상승했습니다
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">이전 레벨</p>
                <p className="text-2xl font-bold">{oldLevel}</p>
              </div>
              <div className="bg-primary/10 p-4 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">현재 레벨</p>
                <p className="text-2xl font-bold text-primary">{newLevel}</p>
              </div>
            </div>

            <div className="text-center mb-6">
              <Badge variant="outline" className="mb-2 py-1 px-3 mx-auto">
                +{xp} EXP 획득
              </Badge>
              <p className="text-sm text-muted-foreground">
                더 많은 활동을 통해 경험치를 획득하고 레벨을 올려보세요!
              </p>
            </div>

            <Button onClick={onClose} className="w-full">
              확인
            </Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 경험치 알림 컴포넌트
export function ExperienceAlert({
  show,
  onClose,
  xp,
  message,
  type,
  oldLevel,
  newLevel,
}: ExpAlertProps) {
  if (type === "levelup") {
    return (
      <LevelUpAlert
        show={show}
        onClose={onClose}
        xp={xp}
        oldLevel={oldLevel}
        newLevel={newLevel}
      />
    );
  }

  return (
    <ExpGainAlert
      show={show}
      onClose={onClose}
      xp={xp}
      message={message}
    />
  );
}

// 경험치 컨텍스트 타입
export type ExperienceAlertContextType = {
  showExpGain: (xp: number, message?: string) => void;
  showLevelUp: (xp: number, oldLevel: number, newLevel: number) => void;
}; 