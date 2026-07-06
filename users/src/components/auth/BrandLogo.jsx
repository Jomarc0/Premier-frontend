import logo from '../../assets/image/logo-premier.webp';
import { BRAND_NAME } from '../../constants/brand';

const BrandLogo = ({ className = 'h-20 w-20' }) => {
  return (
    <div className={`${className} mx-auto rounded-full bg-white p-2.5 shadow-md ring-4 ring-white/75`}>
      <img src={logo} alt={BRAND_NAME} className="h-full w-full object-contain" />
    </div>
  );
};

export default BrandLogo;
