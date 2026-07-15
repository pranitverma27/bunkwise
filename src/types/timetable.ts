'use client';

// Note: This is a placeholder for the server-side logic we will implement.
// We will use a Server Action to keep the API key secure.

export type TimetableSubject = {
  name: string;
  count: number; // instances per week
};

export type TimetableClass = {
  subject: string;
  startTime: string;
  endTime: string;
};

export type TimetableDay = {
  day: string;
  classes: TimetableClass[];
};

export type ParsedTimetable = {
  subjects: string[];
  schedule: TimetableDay[];
};

// We will move the actual API call to a separate file marked 'use server'
