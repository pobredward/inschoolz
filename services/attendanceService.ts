import { db } from "../lib/firebase";
import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { AttendanceRecord, AttendanceState } from "../types";
import { updateUserExperience } from "../utils/experience";

const DAILY_ATTENDANCE_EXP = 10;
const WEEKLY_BONUS_EXP = 20;

function getLocalDateString(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
}

export async function checkAttendance(
  userId: string,
  date: Date,
): Promise<AttendanceState> {
  const attendanceRef = doc(db, "attendance", userId);
  const attendanceDoc = await getDoc(attendanceRef);

  const dateString = getLocalDateString(date);

  if (!attendanceDoc.exists()) {
    // 첫 출석
    const newAttendance: AttendanceRecord = {
      userId,
      attendances: { [dateString]: true },
      streak: 1,
      lastAttendance: Timestamp.fromDate(date),
    };
    await setDoc(attendanceRef, newAttendance);
    await updateUserExperience(userId, DAILY_ATTENDANCE_EXP, "첫 출석체크");
    return {
      canCheckToday: false,
      currentStreak: 1,
      lastAttendance: date,
      monthlyAttendances: { [dateString]: true },
    };
  }

  const attendanceData = attendanceDoc.data() as AttendanceRecord;
  const lastAttendance = attendanceData.lastAttendance.toDate();
  const lastAttendanceDateString = getLocalDateString(lastAttendance);

  if (lastAttendanceDateString === dateString) {
    // 이미 해당 날짜에 출석함
    return {
      canCheckToday: false,
      currentStreak: attendanceData.streak,
      lastAttendance: lastAttendance,
      monthlyAttendances: attendanceData.attendances || {},
    };
  }

  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = getLocalDateString(yesterday);

  const isConsecutive =
    attendanceData.attendances && attendanceData.attendances[yesterdayString];
  const newStreak = isConsecutive ? attendanceData.streak + 1 : 1;

  // 출석체크 업데이트
  const updatedAttendances = {
    ...attendanceData.attendances,
    [dateString]: true,
  };
  await updateDoc(attendanceRef, {
    attendances: updatedAttendances,
    streak: newStreak,
    lastAttendance: Timestamp.fromDate(date),
  });

  // 경험치 부여
  let expGained = DAILY_ATTENDANCE_EXP;
  if (newStreak % 7 === 0) {
    expGained += WEEKLY_BONUS_EXP;
  }

  await updateUserExperience(userId, expGained, `${newStreak}일 연속 출석체크`);

  return {
    canCheckToday: false,
    currentStreak: newStreak,
    lastAttendance: date,
    monthlyAttendances: updatedAttendances,
  };
}

export async function getAttendanceState(
  userId: string,
  date: Date,
): Promise<AttendanceState> {
  const attendanceRef = doc(db, "attendance", userId);
  const attendanceDoc = await getDoc(attendanceRef);

  const dateString = getLocalDateString(date);

  if (!attendanceDoc.exists()) {
    return {
      canCheckToday: true,
      currentStreak: 0,
      lastAttendance: null,
      monthlyAttendances: {},
    };
  }

  const attendanceData = attendanceDoc.data() as AttendanceRecord;
  const lastAttendance = attendanceData.lastAttendance.toDate();
  const lastAttendanceDateString = getLocalDateString(lastAttendance);

  // 현재 주의 월요일 구하기
  const monday = new Date(date);
  monday.setDate(
    date.getDate() - date.getDay() + (date.getDay() === 0 ? -6 : 1),
  );

  const weeklyAttendances: { [key: string]: boolean } = {};
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const currentDateString = getLocalDateString(day);
    weeklyAttendances[currentDateString] =
      (attendanceData.attendances &&
        attendanceData.attendances[currentDateString]) ||
      false;
  }

  const canCheckToday = lastAttendanceDateString !== dateString;

  return {
    canCheckToday,
    currentStreak: attendanceData.streak,
    lastAttendance: lastAttendance,
    monthlyAttendances: weeklyAttendances,
  };
}
