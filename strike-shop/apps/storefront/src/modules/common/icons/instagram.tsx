import React from "react"

import { IconProps } from "types/icon"

const Instagram: React.FC<IconProps> = ({
  size = "20",
  color = "currentColor",
  ...attributes
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...attributes}
    >
      <rect
        x="2.5"
        y="2.5"
        width="15"
        height="15"
        rx="4"
        stroke={color}
        strokeWidth="1.5"
      />
      <circle cx="10" cy="10" r="3.75" stroke={color} strokeWidth="1.5" />
      <circle cx="14.375" cy="5.625" r="0.9375" fill={color} />
    </svg>
  )
}

export default Instagram
