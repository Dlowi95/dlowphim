import type { Metadata } from "next";
import ScheduleClient from "./ScheduleClient";

export const metadata: Metadata = {
  title: "Lịch chiếu | DlowPhim",
  description: "Theo dõi phim và tập mới được cập nhật mỗi ngày trên DlowPhim.",
};

export default function SchedulePage() {
  return <ScheduleClient />;
}
