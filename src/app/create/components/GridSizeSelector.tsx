"use client";

export interface GridSizeOption {
  label: string;
  rows: number;
  cols: number;
  description: string;
}

const GRID_SIZES: GridSizeOption[] = [
  { label: "Mini", rows: 5, cols: 5, description: "Quick puzzle, 5-10 words" },
  { label: "Standard", rows: 15, cols: 15, description: "Classic NYT size, 30-50 words" },
  { label: "Sunday", rows: 21, cols: 21, description: "Large puzzle, 60-80 words" },
];

interface GridSizeSelectorProps {
  selectedSize: { rows: number; cols: number };
  onSizeChange: (rows: number, cols: number) => void;
  wordCount: number;
}

function getRecommendation(wordCount: number): GridSizeOption {
  if (wordCount <= 12) return GRID_SIZES[0]; // Mini
  if (wordCount <= 50) return GRID_SIZES[1]; // Standard
  return GRID_SIZES[2]; // Sunday
}

export function GridSizeSelector({
  selectedSize,
  onSizeChange,
  wordCount,
}: GridSizeSelectorProps) {
  const recommended = getRecommendation(wordCount);

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-black">Grid Size</h2>
      <div className="grid grid-cols-3 gap-3">
        {GRID_SIZES.map((size) => {
          const isSelected =
            selectedSize.rows === size.rows && selectedSize.cols === size.cols;
          const isRecommended =
            size.rows === recommended.rows && size.cols === recommended.cols;

          return (
            <button
              key={size.label}
              onClick={() => onSizeChange(size.rows, size.cols)}
              className={`relative flex flex-col items-center gap-1 p-4 rounded-lg border-2 transition-all ${
                isSelected
                  ? "border-black bg-gray-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              {isRecommended && wordCount > 0 && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
              <span className="font-semibold text-sm text-black">{size.label}</span>
              <span className="text-xs text-gray-600">
                {size.rows}x{size.cols}
              </span>
              <span className="text-xs text-gray-600">{size.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
