import {Link} from 'react-router-dom';
import AuthForm, {type AuthFormProps} from '../components/AuthForm';
import {ArrowLeft} from 'lucide-react';
import {useLang} from '../i18n';

interface AuthPageProps {
  role: AuthFormProps['role'];
  accent: AuthFormProps['accent'];
  backPath: string;
}

export default function AuthPage({role, accent, backPath}: AuthPageProps) {
  const {t} = useLang();
  return (
    <div className="relative flex min-h-[85vh] items-center justify-center overflow-hidden px-4 py-12">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-brand-300/40 blur-3xl" />
        <div className="absolute bottom-0 right-10 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
        <div className="absolute top-32 -left-16 h-64 w-64 rounded-full bg-play-400/20 blur-3xl" />
      </div>
      <div className="w-full max-w-md sm:px-6">
        <Link to={backPath} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-ink-soft transition-colors hover:text-ink">
          <ArrowLeft className="h-4 w-4" />
          {t('back')}
        </Link>
        <AuthForm role={role} accent={accent} />
      </div>
    </div>
  );
}
