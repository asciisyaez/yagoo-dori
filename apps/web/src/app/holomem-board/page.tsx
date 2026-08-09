import type { Metadata } from "next";

import { BoardPlanner } from "@/components/holomem-board/board-planner";

import styles from "./holomem-board.module.css";

export const metadata: Metadata = {
  title: "Holomem Board planner",
  description: "Declare Holomem Boards and review connected unlock suggestions.",
};

export default function HolomemBoardPage() {
  return (
    <div className={styles.page}>
      <BoardPlanner />
    </div>
  );
}
