import React from "react";

export default function PremiumBadge() {
  return (
    <span
      style={{
        marginLeft: 8,
        padding: "2px 10px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        background: "linear-gradient(180deg, #fff6d9 0%, #ffe58f 50%, #f9d74c 100%)",
        border: "1px solid #f1c232",
        color: "#7c5700",
        boxShadow:
          "inset 0 1px 2px rgba(255, 255, 255, 0.8), 0 1px 2px rgba(0,0,0,0.1)",
      }}
      title="Premium member"
    >
      PREMIUM
    </span>
  );
}
