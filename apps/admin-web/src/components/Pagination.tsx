import { Button } from './Button';

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (next: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  return (
    <div className="flex items-center justify-between text-xs text-slate-400">
      <div>
        Page {page} of {totalPages} · {total} total
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </Button>
        <Button variant="ghost" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
