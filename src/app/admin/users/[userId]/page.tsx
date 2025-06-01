"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function UserDetail() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const userId = params?.userId as string;

  // Handle missing userId
  if (!userId) {
    redirect('/admin/users');
  }

  // Fetch user data
  const { data: user, isLoading: userLoading } = api.admin.getUser.useQuery({ userId });
  const { data: activity, isLoading: activityLoading } = api.admin.getUserActivity.useQuery({ userId });

  // Handle authentication
  if (status === "loading") {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!session?.user) {
    redirect('/login');
  }

  const isLoading = userLoading || activityLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
            <div className="p-6">
              <Link href="/admin" className="text-lg font-bold text-gray-900 hover:text-gray-700">
                ← Admin Dashboard
              </Link>
              <nav className="mt-8">
                <Link href="/admin/users" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md">
                  <svg className="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                  User Management
                </Link>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading user details...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex">
          <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
            <div className="p-6">
              <Link href="/admin" className="text-lg font-bold text-gray-900 hover:text-gray-700">
                ← Admin Dashboard
              </Link>
            </div>
          </div>
          <div className="flex-1 p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">User Not Found</h2>
              <p className="mt-2 text-gray-600">The user you're looking for doesn't exist.</p>
              <Link href="/admin/users" className="mt-4 inline-block bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                Back to Users
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
          <div className="p-6">
            <Link href="/admin" className="text-lg font-bold text-gray-900 hover:text-gray-700">
              ← Admin Dashboard
            </Link>
            <nav className="mt-8">
              <Link href="/admin/users" className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md">
                <svg className="mr-3 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                User Management
              </Link>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-8">
          {/* Header */}
          <div className="mb-8 flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">User Details</h1>
              <p className="text-gray-600">View and manage user information</p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/admin/users/${userId}/edit`}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition"
              >
                Edit User
              </Link>
              <Link
                href="/admin/users"
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition"
              >
                Back to Users
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* User Info Card */}
            <div className="lg:col-span-1">
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center mb-6">
                  {user.image && (
                    <img className="h-16 w-16 rounded-full mr-4" src={user.image} alt={user.name || 'User'} />
                  )}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{user.name || 'No name'}</h2>
                    <p className="text-gray-600">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">User ID</label>
                    <p className="mt-1 text-sm text-gray-900 font-mono">{user.id}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-500">Profile Created</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {user.emailVerified ? (
                        <>
                          <span className="text-green-600">✓ Verified</span>
                          <br />
                          <span className="text-gray-500">{new Date(user.emailVerified).toLocaleString()}</span>
                        </>
                      ) : (
                        <span className="text-red-600">✗ Not verified</span>
                      )}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Projects</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold">{user.projectCount}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-500">Total Prompts Submitted</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold">{user.promptCount}</p>
                  </div>

                  {user.latestProject && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Latest Project</label>
                      <p className="mt-1 text-sm text-gray-900">{user.latestProject.title}</p>
                      <p className="text-xs text-gray-500">Updated {user.latestProject.updatedAt ? new Date(user.latestProject.updatedAt).toLocaleDateString() : 'Unknown'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity and Projects */}
            <div className="lg:col-span-2 space-y-8">
              {/* Recent Projects */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Projects</h3>
                {activity?.projects && activity.projects.length > 0 ? (
                  <div className="space-y-3">
                    {activity.projects.map((project) => (
                      <div key={project.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{project.title}</h4>
                            <p className="text-sm text-gray-500">
                              Created: {new Date(project.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              Updated: {project.updatedAt ? new Date(project.updatedAt).toLocaleDateString() : 'Unknown'}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{project.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No projects found.</p>
                )}
              </div>

              {/* Recent Scenes */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scenes</h3>
                {activity?.scenes && activity.scenes.length > 0 ? (
                  <div className="space-y-3">
                    {activity.scenes.map((scene) => (
                      <div key={scene.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">{scene.name}</h4>
                            <p className="text-sm text-gray-500">
                              Created: {new Date(scene.createdAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-500">
                              Project ID: {scene.projectId}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{scene.id}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No scenes found.</p>
                )}
              </div>

              {/* Recent Feedback */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Feedback</h3>
                {activity?.feedback && activity.feedback.length > 0 ? (
                  <div className="space-y-3">
                    {activity.feedback.map((feedbackItem) => (
                      <div key={feedbackItem.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            feedbackItem.status === 'new' ? 'bg-green-100 text-green-800' :
                            feedbackItem.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {feedbackItem.status}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(feedbackItem.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{feedbackItem.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No feedback submitted.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 