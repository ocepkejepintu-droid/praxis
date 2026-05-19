import { getSchoolStatus, listSchoolCourses, listSchoolProgress, listSchoolProgressLogs } from '@/lib/school-progress';

export async function SchoolProgressPanel({ authed }: { authed: boolean }) {
  const status = await getSchoolStatus();
  let courses: Awaited<ReturnType<typeof listSchoolCourses>> = [];
  let progress: Awaited<ReturnType<typeof listSchoolProgress>> = [];
  let error = status.error || '';
  const logs = authed ? listSchoolProgressLogs(6) : [];

  if (authed && status.connected) {
    try {
      [courses, progress] = await Promise.all([listSchoolCourses(), listSchoolProgress()]);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
  }

  return (
    <section className="dcDashboardPanel dcSchoolPanel" id="school-progress">
      <div className="dcSectionIntro">
        <p className="dcEyebrow">School progress adapter</p>
        <h2>{status.connected ? 'LMS connected.' : 'LMS not connected.'}</h2>
        <p>{status.connected ? `${status.provider} · ${status.accountLabel || 'account ready'}` : error || 'Set SCHOOL_ACP_PROVIDER=mock-school for local QA, or configure SCHOOL_ACP_BASE_URL and SCHOOL_ACP_API_KEY.'}</p>
      </div>
      <div className="dcMcpCards">
        <span><strong>{status.provider}</strong><span>provider</span></span>
        <span><strong>{status.authType}</strong><span>auth type</span></span>
        <span><strong>{status.connected ? 'connected' : 'blocked'}</strong><span>status</span></span>
      </div>
      {!authed ? <p className="dcEmpty">Login to view course progress and append learning logs.</p> : null}
      {authed && status.connected ? (
        <div className="dcSchoolGrid">
          <div>
            <h3>Courses</h3>
            {courses.slice(0, 5).map((course) => (
              <a className="dcReportRow" href={course.url || '#'} key={course.id} target={course.url ? '_blank' : undefined} rel="noreferrer">
                <strong>{course.title}</strong>
                <span>{course.status || 'active'} · {course.updatedAt?.slice(0, 10) || 'no update date'}</span>
              </a>
            ))}
          </div>
          <div>
            <h3>Progress</h3>
            {progress.slice(0, 5).map((item) => (
              <article className="dcReportRow" key={`${item.courseId}-${item.title}`}>
                <strong>{item.title}</strong>
                <span>{item.percent ?? 0}% · {item.completed ? 'complete' : 'in progress'} · {item.lastActivityAt?.slice(0, 10) || 'no activity date'}</span>
              </article>
            ))}
          </div>
          <div>
            <h3>Latest logs</h3>
            {logs.length ? logs.map((log) => (
              <article className="dcReportRow" key={log.id}>
                <strong>{log.action}</strong>
                <span>{log.createdAt.slice(0, 10)} · {log.courseId || 'general'} · {log.summary}</span>
              </article>
            )) : <p className="dcEmpty">No school progress logs yet.</p>}
          </div>
        </div>
      ) : null}
    </section>
  );
}
