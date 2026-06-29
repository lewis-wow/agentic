import { prisma } from '@repo/prisma';

export default async function DashboardPage(): Promise<React.ReactNode> {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Projects</h1>
      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet.</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => (
            <li
              key={project.id}
              className="rounded-md border px-4 py-3 text-sm"
            >
              {project.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
