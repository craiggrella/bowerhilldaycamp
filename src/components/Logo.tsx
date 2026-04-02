export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 520 60"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <text
        x="260"
        y="42"
        textAnchor="middle"
        fontFamily="Arial Black, Arial, sans-serif"
        fontWeight="900"
        fontSize="38"
        letterSpacing="3"
      >
        <tspan fill="#FF6B35">B</tspan>
        <tspan fill="#E5243B">O</tspan>
        <tspan fill="#FFB800">W</tspan>
        <tspan fill="#4CAF50">E</tspan>
        <tspan fill="#7B2D8E">R</tspan>
        <tspan fill="#FF6B35"> H</tspan>
        <tspan fill="#E5243B">I</tspan>
        <tspan fill="#FFB800">L</tspan>
        <tspan fill="#4CAF50">L</tspan>
        <tspan fill="#7B2D8E"> D</tspan>
        <tspan fill="#FF6B35">A</tspan>
        <tspan fill="#E5243B">Y</tspan>
        <tspan fill="#FFB800"> C</tspan>
        <tspan fill="#4CAF50">A</tspan>
        <tspan fill="#7B2D8E">M</tspan>
        <tspan fill="#FF6B35">P</tspan>
      </text>
    </svg>
  );
}
