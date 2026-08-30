import {Link} from 'react-router-dom';
import AuthForm, {type AuthFormProps} from '../components/AuthForm';
import {ArrowLeft} from 'lucide-react';

interface AuthPageProps {
  role: AuthFormProps['role'];
  accent: AuthFormProps['accent'];
  backPath: string;
}

export default function AuthPage({role, accent, backPath}: AuthPageProps) {
  return (
    <div className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <Link
        to={backPath}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Orqaga
      </Link>
      <AuthForm role={role} accent={accent} />
    </div>
  );
}
