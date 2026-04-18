import { motion } from "framer-motion";

export function BlackHoleVisual() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Wide ambient purple haze behind everything */}
      <motion.div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "780px",
          height: "780px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse at center, rgba(109,40,217,0.26) 0%, rgba(91,33,182,0.12) 50%, transparent 75%)",
          filter: "blur(70px)",
        }}
        animate={{ opacity: [0.7, 1, 0.75], scale: [0.97, 1.04, 0.99] }}
        transition={{ duration: 8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />

      {/* ── INNER RING (left→right, clockwise) ── 440px, deep blue-violet */}
      {/* Orbit track */}
      <div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          border: "1px solid rgba(109,40,217,0.20)",
        }}
      />
      {/* Rotating beam — deep blue-violet */}
      <motion.div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "500px",
          height: "500px",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(109,40,217,0) 0%, rgba(109,40,217,0) 38%, rgba(124,58,237,0.90) 56%, rgba(167,139,250,1) 68%, rgba(124,58,237,0.90) 80%, rgba(109,40,217,0) 100%)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>

      {/* ── OUTER RING (right→left, counter-clockwise) ── 580px, warm pink-purple */}
      {/* Orbit track */}
      <div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "550px",
          height: "550px",
          borderRadius: "50%",
          border: "1px solid rgba(168,85,247,0.14)",
        }}
      />
      {/* Rotating beam — counter-clockwise, warm pink-purple */}
      <motion.div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "550px",
          height: "550px",
        }}
        animate={{ rotate: -360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, rgba(168,85,247,0) 0%, rgba(168,85,247,0) 38%, rgba(192,132,252,0.88) 56%, rgba(232,210,255,1) 68%, rgba(192,132,252,0.88) 80%, rgba(168,85,247,0) 100%)",
            filter: "blur(8px)",
          }}
        />
      </motion.div>

      {/* Black void centre — sized to cover inside of inner ring */}
      <div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "415px",
          height: "415px",
          borderRadius: "50%",
          background: "#000",
          boxShadow: "0 0 60px 40px #000",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "50vh",
          left: "50%",
          translate: "-50% -50%",
          width: "260px",
          height: "260px",
          borderRadius: "50%",
          background: "#000",
        }}
      />
    </div>
  );
}
