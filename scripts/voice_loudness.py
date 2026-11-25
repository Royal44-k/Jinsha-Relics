"""Integrated loudness for mono PCM voice mastering."""
import math
import numpy as np

def integrated_lufs(samples, rate):
    """BS.1770 mono K-weighting, 400 ms blocks with absolute/relative gates."""
    size = 1 << (len(samples) + rate // 2).bit_length()
    z = np.exp(-2j * np.pi * np.fft.rfftfreq(size))
    response = np.ones(z.shape, dtype=complex)
    for frequency, q, shelf in [(1681.974450955533, .70717523695542, True),
                                (38.13547087602444, .50032703732388, False)]:
        k = math.tan(math.pi * frequency / rate)
        a0 = 1 + k / q + k * k
        a1 = 2 * (k*k - 1) / a0
        a2 = (1 - k / q + k*k) / a0
        if shelf:
            vh = 10 ** (3.999843853973347 / 20)
            vb = vh ** .4996667741545416
            coeff = np.array([vh + vb*k/q + k*k, 2*(k*k-vh), vh-vb*k/q+k*k]) / a0
        else:
            coeff = [1., -2., 1.]
        response *= (coeff[0]+coeff[1]*z+coeff[2]*z*z)/(1+a1*z+a2*z*z)
    filtered = np.fft.irfft(np.fft.rfft(samples, n=size)*response, n=size)[:len(samples)]
    block, hop = round(rate*.4), round(rate*.1)
    sums = np.r_[0., np.cumsum(filtered*filtered)]
    start = np.arange(0, len(samples)-block+1,hop)
    powers = (sums[start+block]-sums[start])/block
    powers = powers[powers>10**((-70+.691)/10)]
    if not len(powers):
        raise ValueError("Silent recording")
    gated = powers[powers>powers.mean()*.1]
    return float(-.691+10*np.log10(np.mean(gated)))
