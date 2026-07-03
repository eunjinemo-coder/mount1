'use client';

/**
 * 재사용 확인 다이얼로그 — A2(목록 행) · A3(상세 카드) 입금확인 공용.
 * 되돌리기 어려운 액션(구매자 SMS/알림톡 발송 트리거) 앞에서 오조작을 막는다.
 * @mount/ui Dialog(라디오 기반 포커스트랩) 재사용 — 신규 디자인 언어 없음.
 */
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@mount/ui';
import type { ReactElement } from 'react';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
}): ReactElement {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button disabled={isPending} onClick={() => onOpenChange(false)} variant="outline">
            {cancelLabel}
          </Button>
          <Button disabled={isPending} onClick={onConfirm}>
            {isPending ? '처리 중…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
