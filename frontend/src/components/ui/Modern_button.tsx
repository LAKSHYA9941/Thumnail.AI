// import styled at the top
import styled from "styled-components";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- your new component ---
const StartCreatingButton = () => {
  const navigate = useNavigate();

  return (
    <StyledWrapper>
      <button
        className="animated-button"
        onClick={() => navigate("/login")}
      >
        {/* left arrow */}
        <svg viewBox="0 0 24 24" className="arr-2">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>

        <span className="text text-2xl">Start Creating Free</span>

        {/* expanding circle */}
        <span className="circle" />

        {/* right arrow */}
        <svg viewBox="0 0 24 24" className="arr-1">
          <path d="M16.1716 10.9999L10.8076 5.63589L12.2218 4.22168L20 11.9999L12.2218 19.778L10.8076 18.3638L16.1716 12.9999H4V10.9999H16.1716Z" />
        </svg>
      </button>
    </StyledWrapper>
  );
};

// --- same CSS as before, but you can tweak values if needed ---
const StyledWrapper = styled.div`
  .animated-button {
    position: relative;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 28px;
    border: 4px solid transparent;
    font-size: 16px;
    background: linear-gradient(to right, #a855f7, #ec4899); /* purple-500 → pink-500 */
    border-radius: 100px;
    font-weight: 600;
    color: #fdf4ff; /* fuchsia-50 */
    box-shadow: 0 0 0 2px #fdf4ff;
    cursor: pointer;
    overflow: hidden;
    transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button svg {
    position: absolute;
    width: 24px;
    fill: #fdf4ff;
    z-index: 9;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .arr-1 { right: 16px; }
  .animated-button .arr-2 { left: -25%; }

  .animated-button .circle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    background-color: #fdf4ff;
    border-radius: 50%;
    opacity: 0;
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button .text {
    position: relative;
    z-index: 1;
    transform: translateX(-12px);
    transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
  }

  .animated-button:hover {
    box-shadow: 0 0 0 12px transparent;
    color: #212121;
    border-radius: 12px;
  }

  .animated-button:hover .arr-1 { right: -25%; }
  .animated-button:hover .arr-2 { left: 16px; }
  .animated-button:hover .text { transform: translateX(12px); }
  .animated-button:hover svg { fill: #212121; }

  .animated-button:active {
    scale: 0.95;
    box-shadow: 0 0 0 4px #fdf4ff;
  }

  .animated-button:hover .circle {
    width: 220px;
    height: 220px;
    opacity: 1;
    color: #fff4ff;
  }
`;

export default StartCreatingButton;