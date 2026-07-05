import logo from '../../assets/image/premier-logo.png';
import { BRAND_NAME } from '../../constants/brand';

const BrandLogo = ({ className = 'w-[5.6rem] h-[5.6rem]' }) => {
    return (
        <div
            className={`${className} mx-auto mb-[1.45rem] rounded-full bg-white p-4 overflow-hidden shadow-[0_10px_22px_rgba(0,0,0,0.18)] ring-4 ring-white/75`}
        >
            <img src={logo} alt={BRAND_NAME} className="w-full h-full object-contain" />
        </div>
    );
};

export default BrandLogo;
